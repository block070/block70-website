export default function DiscoverCategoryLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <section>
        <div className="h-8 w-56 rounded bg-[var(--b70-border)]/60 animate-pulse" />
        <div className="mt-1 h-4 w-96 rounded bg-[var(--b70-border)]/40 animate-pulse" />
      </section>
      <div className="h-32 rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
      <div className="h-24 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5 animate-pulse" />
      <section>
        <div className="mb-3 h-4 w-16 rounded bg-[var(--b70-border)]/60 animate-pulse" />
        <div className="h-96 overflow-hidden rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
      </section>
    </div>
  );
}
