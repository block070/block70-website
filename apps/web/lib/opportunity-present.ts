import type { Opportunity } from "@/lib/types";

export type PresentedOpportunityType = {
  label: string;
  category: "breakout" | "accumulation" | "narrative" | "other";
};

export function presentOpportunityType(op: Opportunity): PresentedOpportunityType {
  const t = (op.type ?? "").toLowerCase();
  const src = (op.source ?? "").toLowerCase();

  if (t === "wallet") {
    return { label: "Accumulation / smart money", category: "accumulation" };
  }
  if (t === "narrative" || src.includes("narrative")) {
    return { label: "Narrative", category: "narrative" };
  }
  if (t === "arbitrage") {
    return { label: "Arbitrage / pricing gap", category: "breakout" };
  }
  if (t === "project_discovery" || src.includes("hunter") || src.includes("spotlight")) {
    return { label: "Early discovery", category: "narrative" };
  }
  if ((op.upside_score ?? 0) >= 0.65 && (op.liquidity_score ?? 0) >= 0.55) {
    return { label: "Momentum / breakout tilt", category: "breakout" };
  }
  if (t === "mining") return { label: "Mining / yield", category: "other" };
  if (t === "airdrop") return { label: "Airdrop / incentive", category: "other" };

  return {
    label: t ? t.replace(/_/g, " ") : "Opportunity",
    category: "other",
  };
}

export function confidencePercent(op: Opportunity): number {
  return Math.round(Math.max(0, Math.min(1, op.confidence_score ?? 0)) * 100);
}

export function modelScorePercent(op: Opportunity): number {
  return Math.round(Math.max(0, Math.min(1, op.total_score ?? 0)) * 100);
}

export type TimeHorizon = "short" | "mid" | "long";

export function timeHorizon(op: Opportunity): { horizon: TimeHorizon; label: string } {
  if (op.expires_at) {
    const exp = new Date(op.expires_at).getTime();
    const now = Date.now();
    if (!Number.isNaN(exp) && exp > now && exp - now < 24 * 3600 * 1000) {
      return { horizon: "short", label: "Short (expires within 24h)" };
    }
  }
  const t = (op.type ?? "").toLowerCase();
  if (t === "arbitrage" || t === "airdrop") {
    return { horizon: "short", label: "Short-term (heuristic)" };
  }
  if (t === "mining") {
    return { horizon: "mid", label: "Mid-term" };
  }
  return { horizon: "long", label: "Longer horizon" };
}

export function normalizedRisk(op: Opportunity): "low" | "medium" | "high" {
  const r = (op.risk_level ?? "").toLowerCase();
  if (r.includes("low")) return "low";
  if (r.includes("high")) return "high";
  if (r.includes("medium") || r.includes("med")) return "medium";
  const rs = op.risk_score ?? 0.5;
  if (rs <= 0.33) return "low";
  if (rs >= 0.67) return "high";
  return "medium";
}

export function supportingSignalFlags(op: Opportunity): string[] {
  const flags: string[] = [];
  const t = (op.type ?? "").toLowerCase();
  const src = (op.source ?? "").toLowerCase();

  if (t === "wallet") flags.push("Whale / wallet activity");
  if ((op.liquidity_score ?? 0) >= 0.58) flags.push("Liquidity supportive");
  if ((op.freshness_score ?? 0) >= 0.58) flags.push("Fresh signal");
  if (t === "narrative" || src.includes("narrative")) flags.push("Narrative channel");
  if ((op.upside_score ?? 0) >= 0.65) flags.push("Momentum / upside tilt");

  try {
    const raw = op.raw_payload;
    if (raw && typeof raw === "object") {
      const blob = JSON.stringify(raw).toLowerCase();
      if (blob.includes("volume") && !flags.some((f) => f.includes("Momentum")))
        flags.push("Volume context (signal payload)");
    }
  } catch {
    /* ignore */
  }

  return [...new Set(flags)].slice(0, 4);
}

export function whySummaryLine(op: Opportunity): string {
  if (op.summary?.trim()) {
    const s = op.summary.trim();
    const m = s.match(/^.{1,220}?[.!?](?:\s|$)/);
    return (m ? m[0] : s).slice(0, 220).trim();
  }
  return `${op.title}: model-scored opportunity—research on detail page. Not financial advice.`;
}

export type ActionSketch = {
  entryHint: string | null;
  exitHint: string | null;
  stopHint: string | null;
  disclaimer: string;
};

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${Math.round(value)}`;
}

/** Illustrative only — no live order book. */
export function actionSketchFromEstimates(op: Opportunity): ActionSketch {
  const disclaimer =
    "Illustrative envelope from engine estimates only—not live quotes, fills, or instructions.";

  const cost = op.estimated_cost;
  const roi = op.estimated_roi_percent;
  const upside = op.estimated_upside;

  const entryHint =
    cost != null && Number.isFinite(cost) && cost > 0
      ? `Notional sizing ~ ${formatUsd(cost)}`
      : null;

  let exitHint: string | null = null;
  if (roi != null && Number.isFinite(roi)) {
    exitHint = `Illustrative upside target ~ +${roi.toFixed(0)}% (model)`;
  } else if (upside != null && Number.isFinite(upside)) {
    const u = upside <= 3 ? upside * 100 : upside;
    exitHint = `Illustrative move ~ +${u.toFixed(0)}% (model)`;
  }

  const stopPct =
    roi != null && Number.isFinite(roi) && roi > 0
      ? Math.min(25, Math.max(4, Math.round(roi * 0.22)))
      : 12;
  const stopHint = `Illustratory risk sketch ~ -${stopPct}% (you set real stops)`;

  if (!entryHint && !exitHint) {
    return {
      entryHint: null,
      exitHint: null,
      stopHint: null,
      disclaimer,
    };
  }

  return {
    entryHint,
    exitHint,
    stopHint,
    disclaimer,
  };
}

export function urgencyLabel(op: Opportunity): string | null {
  if (op.expires_at) {
    const exp = new Date(op.expires_at).getTime();
    const now = Date.now();
    if (!Number.isNaN(exp) && exp > now) {
      const ms = exp - now;
      if (ms < 72 * 3600 * 1000) {
        const h = Math.max(1, Math.round(ms / 3600000));
        return `Time-sensitive · expires ~${h}h`;
      }
    }
  }
  if (op.detected_at) {
    const detected = new Date(op.detected_at).getTime();
    if (!Number.isNaN(detected)) {
      const age = Date.now() - detected;
      if (age >= 0 && age < 2 * 3600 * 1000) {
        const m = Math.max(1, Math.round(age / 60000));
        return `Just surfaced · ${m}m ago`;
      }
    }
  }
  return null;
}

export function matchesShortHorizon(op: Opportunity): boolean {
  return timeHorizon(op).horizon === "short";
}
