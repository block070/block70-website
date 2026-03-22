export default function CoinsLoading() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="h-8 w-48 rounded bg-[var(--b70-border)]/60 animate-pulse" />
        <div className="h-4 w-96 rounded bg-[var(--b70-border)]/40 animate-pulse" />
      </header>
      <div className="h-16 rounded-xl bg-[var(--b70-border)]/40 animate-pulse" />
      <div className="overflow-hidden rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)]">
        <div className="h-10 border-b border-[var(--b70-border)] bg-[var(--b70-bg)]/50" />
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div key={i} className="flex h-12 items-center gap-4 border-b border-[var(--b70-border)]/50 px-4 last:border-0">
            <div className="h-4 w-6 rounded bg-[var(--b70-border)]/50 animate-pulse" />
            <div className="h-4 w-24 rounded bg-[var(--b70-border)]/50 animate-pulse" />
            <div className="h-4 w-16 rounded bg-[var(--b70-border)]/50 animate-pulse" />
            <div className="h-4 w-12 rounded bg-[var(--b70-border)]/50 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
