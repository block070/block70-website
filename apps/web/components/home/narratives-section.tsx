export function NarrativesSection() {
  return (
    <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--b70-text)]">
            Narratives
          </h3>
          <p className="mt-0.5 text-[11px] text-[var(--b70-text-muted)]">
            Themes will appear here once the narratives engine has detected
            clusters across tokens and chains.
          </p>
        </div>
      </div>
    </section>
  );
}
