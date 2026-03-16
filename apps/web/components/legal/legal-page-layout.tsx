import type { ReactNode } from "react";

type LegalPageLayoutProps = {
  title: string;
  lastUpdated?: string;
  children: ReactNode;
};

export function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: LegalPageLayoutProps) {
  return (
    <article className="mx-auto max-w-3xl py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          {title}
        </h1>
        {lastUpdated && (
          <p className="mt-2 text-sm text-slate-500">
            Last updated: {lastUpdated}
          </p>
        )}
      </header>
      <div className="prose prose-invert prose-slate max-w-none text-sm text-slate-300">
        {children}
      </div>
    </article>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-medium text-slate-100">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  return <p className="leading-relaxed">{children}</p>;
}
