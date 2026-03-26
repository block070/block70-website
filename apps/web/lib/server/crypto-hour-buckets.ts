import { addHours } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

import { CRYPTO_HOUR_DISPLAY_TZ } from "@/lib/crypto-hour-dates";

const TZ = CRYPTO_HOUR_DISPLAY_TZ;

/** Chicago wall-clock hour → UTC interval [start, end). */
export function chicagoHourRangeUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
): { start: Date; end: Date } {
  const wall = new Date(year, month - 1, day, hour, 0, 0, 0);
  const start = fromZonedTime(wall, TZ);
  const end = addHours(start, 1);
  return { start, end };
}

/** Start of Chicago calendar day → UTC Date. */
export function chicagoDayStartUtc(year: number, month: number, day: number): Date {
  const wall = new Date(year, month - 1, day, 0, 0, 0, 0);
  return fromZonedTime(wall, TZ);
}

export function chicagoDayEndUtc(year: number, month: number, day: number): Date {
  const wall = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return fromZonedTime(wall, TZ);
}

/** Current instant → Chicago wall parts. */
export function nowChicagoParts(d = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  const pick = (t: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
  };
}
