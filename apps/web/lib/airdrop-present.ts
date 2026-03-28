import type { Opportunity } from "@/lib/types";

export type AirdropChecklistStep = { id: string; label: string };

const GENERIC_STEPS: AirdropChecklistStep[] = [
  {
    id: "verify",
    label:
      "Verify the official link from the project or listing before connecting a wallet.",
  },
  {
    id: "seed",
    label: "Never share your seed phrase or private keys with anyone.",
  },
  {
    id: "dyor",
    label:
      "Do your own research (DYOR). Listings are informational, not endorsements.",
  },
];

function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function splitSummaryToSteps(summary: string): string[] {
  const text = stripHtml(summary).replace(/\s+/g, " ").trim();
  if (!text) return [];

  const bulletParts = text
    .split(/\n+/)
    .flatMap((line) => line.split(/\s*[•\-\*]\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 8);

  const uniqBullets = [...new Set(bulletParts)];
  if (uniqBullets.length >= 2) {
    return uniqBullets.slice(0, 8);
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
  return [...new Set(sentences)].slice(0, 8);
}

/**
 * Checklist from opportunity summary when there are enough distinct steps;
 * otherwise three safe generic reminders (no invented protocol steps).
 */
export function deriveChecklistSteps(op: Opportunity): AirdropChecklistStep[] {
  const fromText = op.summary ? splitSummaryToSteps(op.summary) : [];
  if (fromText.length >= 2) {
    return fromText.map((label, i) => ({ id: `s${i}`, label }));
  }
  return GENERIC_STEPS.map((s) => ({ ...s }));
}

export function formatAirdropValueLine(op: Opportunity): {
  primary: string;
  isEstimate: boolean;
} {
  const v = op.estimated_upside;
  if (v != null && Number.isFinite(v)) {
    const primary =
      v >= 1_000_000
        ? `~$${(v / 1_000_000).toFixed(1)}M est.`
        : v >= 1_000
          ? `~$${(v / 1_000).toFixed(1)}k est.`
          : `~$${v.toFixed(0)} est.`;
    return { primary, isEstimate: true };
  }
  return { primary: "Value TBD", isEstimate: false };
}

export function formatDifficultyPresentation(op: Opportunity): string {
  const level = (op.difficulty_level || "").trim();
  if (level) {
    const lower = level.toLowerCase();
    if (lower === "low") return "Low effort";
    if (lower === "medium") return "Medium effort";
    if (lower === "high") return "High effort";
    return level.charAt(0).toUpperCase() + level.slice(1);
  }
  const s = op.difficulty_score;
  if (s <= 0.35) return "Low effort (score)";
  if (s >= 0.7) return "High effort (score)";
  return "Medium effort (score)";
}

/** Rough time hint from difficulty — not a promise of how long tasks take. */
export function formatAirdropTimeEstimate(op: Opportunity): string {
  const level = (op.difficulty_level || "").toLowerCase();
  if (level === "low") return "~A few hours (typical)";
  if (level === "high") return "~Days to weeks (varies)";
  if (level === "medium") return "~About 1–2 days (typical)";
  const score = op.difficulty_score;
  if (score <= 0.35) return "~A few hours (typical)";
  if (score >= 0.7) return "~Days to weeks (varies)";
  return "~About 1–2 days (typical)";
}

export function isNewOpportunity(iso: string | null, days: number): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() <= days * 86_400_000;
}

export const AIRDROP_NEW_DAYS_DEFAULT = 14;

export type AirdropPresetId = "all" | "high-value" | "low-effort" | "new";

function sortByHighValue(items: Opportunity[]): Opportunity[] {
  return [...items].sort((a, b) => {
    const au = a.estimated_upside;
    const bu = b.estimated_upside;
    if (au != null && bu != null && au !== bu) return bu - au;
    if (au != null && bu == null) return -1;
    if (au == null && bu != null) return 1;
    return b.upside_score - a.upside_score;
  });
}

function isLowEffort(o: Opportunity): boolean {
  return (
    (o.difficulty_level || "").toLowerCase() === "low" ||
    o.difficulty_score <= 0.35
  );
}

/** Filter (where needed), then sort for the rewards discovery preset. */
export function applyAirdropPreset(
  items: Opportunity[],
  preset: AirdropPresetId,
): Opportunity[] {
  const airdrops = items.filter((o) => o.type === "airdrop");
  if (preset === "all") {
    return [...airdrops].sort((a, b) => b.total_score - a.total_score);
  }
  if (preset === "high-value") {
    return sortByHighValue(airdrops);
  }
  if (preset === "low-effort") {
    const filtered = airdrops.filter(isLowEffort);
    return filtered.sort((a, b) => b.total_score - a.total_score);
  }
  const fresh = airdrops.filter((o) =>
    isNewOpportunity(o.detected_at, AIRDROP_NEW_DAYS_DEFAULT),
  );
  return fresh.sort((a, b) => {
    const ta = a.detected_at ? new Date(a.detected_at).getTime() : 0;
    const tb = b.detected_at ? new Date(b.detected_at).getTime() : 0;
    return tb - ta;
  });
}
