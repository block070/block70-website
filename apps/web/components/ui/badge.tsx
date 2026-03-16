import type { ReactNode } from "react";
import { clsx } from "clsx";

type BadgeVariant =
  | "default"
  | "primary"
  | "secondary"
  | "alert"
  | "muted"
  | "signal-type"
  | "confidence"
  | "difficulty"
  | "narrative";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

const variantClass: Record<BadgeVariant, string> = {
  default:
    "border-[var(--b70-border)] bg-[var(--b70-card)] text-[var(--b70-text-muted)] dark:bg-[var(--b70-border)]/30",
  primary:
    "border-crypto-blue/50 bg-crypto-blue/20 text-crypto-blue",
  secondary:
    "border-crypto-green/50 bg-crypto-green/20 text-crypto-green dark:text-crypto-green",
  alert:
    "border-crypto-orange/50 bg-crypto-orange/20 text-crypto-orange",
  muted:
    "border-[var(--b70-border)] bg-[var(--b70-border)]/30 text-[var(--b70-text-muted)]",
  "signal-type":
    "border-crypto-blue/40 bg-crypto-blue/15 text-crypto-blue small",
  confidence:
    "border-crypto-green/40 bg-crypto-green/15 text-crypto-green small",
  difficulty:
    "border-crypto-orange/40 bg-crypto-orange/15 text-crypto-orange small",
  narrative:
    "border-[var(--b70-border)] bg-[var(--b70-card)] text-[var(--b70-text)] small",
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        variantClass[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
