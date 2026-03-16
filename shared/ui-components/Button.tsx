import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import clsx from "clsx";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary";
  }
>;

export function Button({ children, className, variant = "primary", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60";

  const styles =
    variant === "primary"
      ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
      : "border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800";

  return (
    <button className={clsx(base, styles, className)} {...props}>
      {children}
    </button>
  );
}

