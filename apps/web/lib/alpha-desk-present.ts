import type { Opportunity } from "@/lib/types";

/** API alpha_type values — display-only mapping, do not persist changed labels to API. */
export type CommunityAlphaTypeApi = "trade_idea" | "signal" | "strategy" | "research";

export function presentCommunityAlphaCategory(alphaType: string): {
  label: string;
  short: string;
} {
  const t = (alphaType ?? "").toLowerCase();
  switch (t) {
    case "research":
      return { label: "Early narratives", short: "Narratives" };
    case "signal":
      return { label: "Whale & flow signal", short: "Flow" };
    case "strategy":
      return { label: "Market inefficiency / playbook", short: "Playbook" };
    case "trade_idea":
      return { label: "Hidden gem / thesis", short: "Thesis" };
    default:
      return { label: alphaType.replace(/_/g, " ") || "Alpha", short: "Alpha" };
  }
}

export function confidencePercent(score: number | null | undefined): number {
  if (score == null || Number.isNaN(score)) return 0;
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

export type ParsedAlphaPostSections = {
  summary: string;
  keyInsight: string | null;
  whyItMatters: string | null;
  potentialImpact: string | null;
  usedMarkers: boolean;
  /** Shown when post is short and paragraph split is thin. */
  unstructuredNote: string | null;
};

const MARKER_START =
  /^\s*(key insight|why it matters|potential impact)\s*:\s*(.*)$/i;

function normalizeParagraphs(raw: string): string[] {
  return raw
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

/** Parse community post body into summary / insight / why / impact without inventing facts. */
export function parseAlphaPostSections(content: string): ParsedAlphaPostSections {
  const raw = (content ?? "").trim();
  if (!raw) {
    return {
      summary: "",
      keyInsight: null,
      whyItMatters: null,
      potentialImpact: null,
      usedMarkers: false,
      unstructuredNote: null,
    };
  }

  const lines = raw.split(/\r?\n/);
  const hasMarkers = lines.some((l) => MARKER_START.test(l));

  if (hasMarkers) {
    type Bucket = "summary" | "keyInsight" | "whyItMatters" | "potentialImpact";
    let bucket: Bucket = "summary";
    const parts: Record<Bucket, string[]> = {
      summary: [],
      keyInsight: [],
      whyItMatters: [],
      potentialImpact: [],
    };

    for (const line of lines) {
      const m = line.match(MARKER_START);
      if (m) {
        const label = m[1].toLowerCase();
        const rest = (m[2] ?? "").trim();
        if (label.startsWith("key insight")) bucket = "keyInsight";
        else if (label.startsWith("why it matters")) bucket = "whyItMatters";
        else bucket = "potentialImpact";
        if (rest) parts[bucket].push(rest);
        continue;
      }
      if (line.trim()) parts[bucket].push(line.trim());
    }

    const join = (arr: string[]) => (arr.length ? arr.join(" ").trim() : null);

    return {
      summary: join(parts.summary) ?? "",
      keyInsight: join(parts.keyInsight),
      whyItMatters: join(parts.whyItMatters),
      potentialImpact: join(parts.potentialImpact),
      usedMarkers: true,
      unstructuredNote: null,
    };
  }

  const paras = normalizeParagraphs(raw);
  if (paras.length === 0) {
    return {
      summary: raw,
      keyInsight: null,
      whyItMatters: null,
      potentialImpact: null,
      usedMarkers: false,
      unstructuredNote: null,
    };
  }

  if (paras.length === 1) {
    return {
      summary: paras[0],
      keyInsight: null,
      whyItMatters: null,
      potentialImpact: null,
      usedMarkers: false,
      unstructuredNote:
        "Author did not split into sections—open the full post for discussion.",
    };
  }

  const [p0, p1, ...rest] = paras;
  const p2 = rest[0] ?? null;
  const p3 = rest.length > 1 ? rest.slice(1).join(" ") : null;

  return {
    summary: p0,
    keyInsight: p1,
    whyItMatters: p2,
    potentialImpact: p3,
    usedMarkers: false,
    unstructuredNote: null,
  };
}

export function engineBriefImpactLine(opp: Opportunity): string | null {
  const roi = opp.estimated_roi_percent;
  const risk = opp.risk_level?.trim();
  const bits: string[] = [];
  if (roi != null && Number.isFinite(roi)) {
    bits.push(`Modeled ROI context ~ +${roi.toFixed(0)}% (not a forecast)`);
  }
  if (risk) bits.push(`Risk: ${risk}`);
  if (!bits.length) return null;
  return bits.join(" · ");
}

/** One-line “why” for engine cards from persisted fields only. */
export function engineWhyLine(opp: Opportunity): string {
  if (opp.summary?.trim()) {
    const s = opp.summary.trim();
    return s.length > 200 ? `${s.slice(0, 197)}…` : s;
  }
  if (opp.thesis?.trim()) {
    const t = opp.thesis.trim();
    return t.length > 200 ? `${t.slice(0, 197)}…` : t;
  }
  return `${opp.title} — scored opportunity; verify on detail.`;
}

export const DESK_PICKS_COUNT = 3;
export const PREMIUM_POST_CONFIDENCE_THRESHOLD = 0.85;
