import { addHours } from "date-fns";

import { chicagoHourRangeUtc } from "@/lib/server/crypto-hour-buckets";

const YEAR_RE = /^(20[2-3]\d)$/;
const MONTH_RE = /^(0?[1-9]|1[0-2])$/;
const DAY_RE = /^(0?[1-9]|[12]\d|3[01])$/;
const HM_RE = /^([01]?\d|2[0-3])-([0-5]\d)$/;

export type CohRouteParsed =
  | { kind: "year"; year: number }
  | { kind: "month"; year: number; month: number }
  | { kind: "day"; year: number; month: number; day: number }
  | { kind: "hour"; year: number; month: number; day: number; hour: number; minute: number }
  | { kind: "legacyNumericHour"; n: string }
  | { kind: "article"; slug: string };

export function parseCohSegments(segments: string[]): CohRouteParsed | null {
  if (!segments.length) return null;
  const [a, b, c, d] = segments;
  const dec = (s: string) => parseInt(s, 10);

  if (segments.length === 1) {
    const s = a ?? "";
    if (YEAR_RE.test(s)) return { kind: "year", year: dec(s) };
    if (/^\d+$/.test(s)) return { kind: "legacyNumericHour", n: s };
    return { kind: "article", slug: decodeURIComponent(s) };
  }

  if (segments.length === 2 && YEAR_RE.test(a ?? "") && MONTH_RE.test(b ?? "")) {
    return { kind: "month", year: dec(a!), month: dec(b!) };
  }

  if (
    segments.length === 3 &&
    YEAR_RE.test(a ?? "") &&
    MONTH_RE.test(b ?? "") &&
    DAY_RE.test(c ?? "")
  ) {
    return { kind: "day", year: dec(a!), month: dec(b!), day: dec(c!) };
  }

  if (
    segments.length === 4 &&
    YEAR_RE.test(a ?? "") &&
    MONTH_RE.test(b ?? "") &&
    DAY_RE.test(c ?? "") &&
    HM_RE.test(d ?? "")
  ) {
    const m = HM_RE.exec(d!);
    const hh = dec(m![1]!);
    const mm = dec(m![2]!);
    return { kind: "hour", year: dec(a!), month: dec(b!), day: dec(c!), hour: hh, minute: mm };
  }

  return null;
}

export function pathForChicagoHour(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): string {
  const hm = `${hour.toString().padStart(2, "0")}-${minute.toString().padStart(2, "0")}`;
  return `/crypto-on-the-hour/${year}/${month}/${day}/${hm}`;
}

export function pathForDay(year: number, month: number, day: number): string {
  return `/crypto-on-the-hour/${year}/${month}/${day}`;
}

export function pathForMonth(year: number, month: number): string {
  return `/crypto-on-the-hour/${year}/${month}`;
}

export function pathForYear(year: number): string {
  return `/crypto-on-the-hour/${year}`;
}

/** Hour slots (Chicago) for a calendar day — 24 entries at :00. */
export function hourSlotsForChicagoDay(
  year: number,
  month: number,
  day: number,
): { label: string; path: string; start: Date }[] {
  const out: { label: string; path: string; start: Date }[] = [];
  for (let h = 0; h < 24; h++) {
    const { start } = chicagoHourRangeUtc(year, month, day, h);
    const label = `${h.toString().padStart(2, "0")}:00`;
    out.push({
      label,
      path: pathForChicagoHour(year, month, day, h, 0),
      start,
    });
  }
  return out;
}

export function previousChicagoHour(
  year: number,
  month: number,
  day: number,
  hour: number,
): { year: number; month: number; day: number; hour: number } {
  const { start } = chicagoHourRangeUtc(year, month, day, hour);
  const prev = addHours(start, -1);
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  }).formatToParts(prev);
  const pick = (t: Intl.DateTimeFormatPartTypes) =>
    parseInt(p.find((x) => x.type === t)?.value ?? "0", 10);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
  };
}

/** Same clock hour previous calendar day (Chicago). */
export function pathYesterdayFromHourStart(hourStartIso: string): string {
  const prev = addHours(new Date(hourStartIso), -24);
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  }).formatToParts(prev);
  const pick = (t: Intl.DateTimeFormatPartTypes) =>
    parseInt(p.find((x) => x.type === t)?.value ?? "0", 10);
  return pathForChicagoHour(pick("year"), pick("month"), pick("day"), pick("hour"), 0);
}
