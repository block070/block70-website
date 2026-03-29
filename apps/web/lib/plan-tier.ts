/** `block70_plan` cookie / auth `plan` values that unlock paid market data UX. */
export function isPaidBlock70Plan(plan: string | undefined | null): boolean {
  const p = (plan ?? "free").toLowerCase();
  return p === "pro" || p === "elite" || p === "admin";
}
