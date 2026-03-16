import type { ReactNode } from "react";
import { clsx } from "clsx";

type CardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
};

export function Card({
  children,
  className = "",
  hover = true,
}: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-b70-lg border bg-[var(--b70-card)] shadow-b70-card transition-all duration-200",
        "border-[var(--b70-border)]",
        hover &&
          "hover:-translate-y-0.5 hover:border-[var(--b70-crypto-blue)]/30 hover:shadow-b70-card-hover dark:hover:shadow-b70-glow-blue/20",
        className,
      )}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--b70-border)] px-4 py-3">
      <div>
        <h3 className="heading-md">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 small">{subtitle}</p>
        ) : null}
      </div>
      {action ?? null}
    </div>
  );
}
