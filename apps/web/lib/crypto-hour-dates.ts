/** Matches pipeline cron (`PIPELINE_CRON_TZ` on the engine). */
export const CRYPTO_HOUR_DISPLAY_TZ = "America/Chicago";

/**
 * Show the **wall-clock hour** in Chicago (always :00) for the instant `d`.
 * Example: 3:36 PM CDT → "Mar 25, 2026, 3:00 PM CDT"
 */
export function formatCryptoHourOnTheHour(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CRYPTO_HOUR_DISPLAY_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    hour12: true,
    timeZoneName: "short",
  }).formatToParts(d);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("month")} ${pick("day")}, ${pick("year")}, ${pick("hour")}:00 ${pick("dayPeriod")} ${pick("timeZoneName")}`;
}
