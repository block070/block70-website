/**
 * Server-only fallbacks when market_narratives / intelligence is empty but narrative opportunities exist.
 */

export type TrendOpp = {
  id?: number;
  title?: string;
  summary?: string | null;
  total_score?: number;
  upside_score?: number;
  risk_score?: number;
  asset_symbol?: string | null;
  created_at?: string;
  detected_at?: string | null;
};

const GROWTH_EPS = 1e-6;

function oppEffectiveTime(o: TrendOpp): Date | null {
  const s = o.detected_at ?? o.created_at;
  if (!s || typeof s !== "string") return null;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t);
}

/** Match FastAPI narrative intelligence: WoW on summed scores in 7d windows. */
function growthRateForOpportunityGroup(group: TrendOpp[]): number | null {
  const now = Date.now();
  const ms7 = 7 * 24 * 60 * 60 * 1000;
  const recentStart = now - ms7;
  const prevStart = now - 2 * ms7;
  const prevEnd = recentStart;

  let recent = 0;
  let prev = 0;
  for (const o of group) {
    const eff = oppEffectiveTime(o);
    if (!eff) continue;
    const sc = typeof o.total_score === "number" ? o.total_score : 0;
    const t = eff.getTime();
    if (t >= recentStart && t <= now) recent += sc;
    if (t >= prevStart && t <= prevEnd) prev += sc;
  }

  if (prev <= GROWTH_EPS) {
    return recent > GROWTH_EPS ? null : 0;
  }
  return (recent - prev) / prev;
}

function utcLast14Dates(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i),
    );
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function syntheticNarrativesFromTrending(opps: TrendOpp[], cap: number): unknown[] {
  const groups = new Map<string, TrendOpp[]>();
  for (const o of opps) {
    const t = (o.title || "").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(o);
  }
  const ranked = [...groups.entries()].sort((a, b) => {
    const sum = (g: TrendOpp[]) =>
      g.reduce((s, x) => s + (typeof x.total_score === "number" ? x.total_score : 0), 0);
    return sum(b[1]) - sum(a[1]);
  });
  const dates = utcLast14Dates();
  const today = dates[dates.length - 1] ?? "";
  const rows: unknown[] = [];
  let sid = -1;
  for (let i = 0; i < Math.min(cap, ranked.length); i++) {
    const [_k, group] = ranked[i]!;
    const name = (group[0]!.title || "").trim();
    if (!name) continue;
    const attention = group.reduce(
      (s, o) => s + (typeof o.total_score === "number" ? o.total_score : 0),
      0,
    );
    const sentVals = group.map(
      (o) =>
        (typeof o.upside_score === "number" ? o.upside_score : 0) -
        (typeof o.risk_score === "number" ? o.risk_score : 0),
    );
    const sentiment = Math.max(
      -1,
      Math.min(1, sentVals.reduce((a, b) => a + b, 0) / Math.max(sentVals.length, 1)),
    );
    const symbols = [
      ...new Set(
        group
          .map((o) => o.asset_symbol)
          .filter((x): x is string => typeof x === "string" && x.length > 0),
      ),
    ].slice(0, 8);
    const bestScore = Math.max(
      ...group.map((o) => (typeof o.total_score === "number" ? o.total_score : 0)),
    );
    const daily_series = dates.map((date) => ({
      date,
      attention: date === today ? attention : 0,
    }));
    rows.push({
      id: sid--,
      name,
      description: group[0]!.summary ?? null,
      trend_score: bestScore,
      created_at: group[0]!.created_at ?? null,
      attention,
      sentiment,
      growth_rate: growthRateForOpportunityGroup(group),
      related_symbols: symbols,
      daily_series,
    });
  }
  return rows;
}

/** Build GET /narratives/detail shape from trending rows sharing the same title as `decodedSlug`. */
export function intelligenceDetailFromTrendingSlug(
  decodedSlug: string,
  allOpps: TrendOpp[],
): Record<string, unknown> | null {
  const key = decodedSlug.trim().toLowerCase();
  if (!key) return null;
  const group = allOpps.filter(
    (o) => (o.title || "").trim().toLowerCase() === key,
  );
  if (group.length === 0) return null;

  const name = (group[0]!.title || "").trim();
  const attention = group.reduce(
    (s, o) => s + (typeof o.total_score === "number" ? o.total_score : 0),
    0,
  );
  const sentVals = group.map(
    (o) =>
      (typeof o.upside_score === "number" ? o.upside_score : 0) -
      (typeof o.risk_score === "number" ? o.risk_score : 0),
  );
  const sentiment = Math.max(
    -1,
    Math.min(1, sentVals.reduce((a, b) => a + b, 0) / Math.max(sentVals.length, 1)),
  );
  const symbols = [
    ...new Set(
      group
        .map((o) => o.asset_symbol)
        .filter((x): x is string => typeof x === "string" && x.length > 0),
    ),
  ].slice(0, 8);
  const bestScore = Math.max(
    ...group.map((o) => (typeof o.total_score === "number" ? o.total_score : 0)),
  );
  const dates = utcLast14Dates();
  const today = dates[dates.length - 1] ?? "";
  const daily_series = dates.map((date) => ({
    date,
    attention: date === today ? attention : 0,
  }));
  const oid = Math.min(...group.map((o) => (typeof o.id === "number" ? o.id : 10 ** 9)));

  const opportunities = [...group].sort(
    (a, b) =>
      (typeof b.total_score === "number" ? b.total_score : 0) -
      (typeof a.total_score === "number" ? a.total_score : 0),
  );

  return {
    id: -oid,
    name,
    description: group[0]!.summary ?? null,
    trend_score: bestScore,
    created_at: group[0]!.created_at ?? null,
    attention,
    sentiment,
    growth_rate: growthRateForOpportunityGroup(group),
    related_symbols: symbols,
    daily_series,
    opportunities,
  };
}
