export default function CapitalFlowLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 max-w-full rounded bg-[var(--b70-border)]/60 animate-pulse" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-80 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
        <div className="h-80 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
      </div>
    </div>
  );
}
