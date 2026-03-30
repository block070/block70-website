import type { ReactNode } from "react";
import { clsx } from "clsx";

export function SalesSection({
  kicker,
  title,
  children,
  className,
  id,
}: {
  kicker?: string;
  title: string;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={clsx("scroll-mt-24 py-14 md:py-16", className)}>
      {kicker ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
          {kicker}
        </p>
      ) : null}
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--b70-text)] md:text-3xl">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}
