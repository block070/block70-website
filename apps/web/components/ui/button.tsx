import type { ButtonHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "outline" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
  className?: string;
};

const variantClass: Record<Variant, string> = {
  primary:
    "bg-crypto-blue text-white border-crypto-blue hover:bg-crypto-blue/90 active:bg-crypto-blue/80 shadow-b70-card",
  secondary:
    "bg-crypto-green text-[#0E1117] border-crypto-green hover:bg-crypto-green/90 active:bg-crypto-green/80",
  outline:
    "bg-transparent border-[var(--b70-border)] text-[var(--b70-text)] hover:bg-[var(--b70-card)] hover:border-crypto-blue/50 active:bg-[var(--b70-border)]",
  ghost:
    "bg-transparent border-transparent text-[var(--b70-text-muted)] hover:bg-[var(--b70-border)] hover:text-[var(--b70-text)] active:bg-[var(--b70-border)]",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex items-center justify-center rounded-b70-md border px-4 py-2 body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crypto-blue focus-visible:ring-offset-2 disabled:opacity-50",
        "dark:focus-visible:ring-offset-[var(--b70-bg)]",
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
