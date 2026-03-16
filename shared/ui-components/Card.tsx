import type { PropsWithChildren, ReactNode } from "react";
import clsx from "clsx";

type CardProps = PropsWithChildren<{
  title?: ReactNode;
  className?: string;
}>;

export function Card({ title, className, children }: CardProps) {
  return (
    <section
      className={clsx(
        "rounded-xl border border-slate-800 bg-slate-900/60 p-4",
        className,
      )}
    >
      {title ? (
        <header className="mb-2">
          <h2 className="text-sm font-semibold text-slate-50">{title}</h2>
        </header>
      ) : null}
      <div className="text-sm text-slate-200">{children}</div>
    </section>
  );
}

