export default function NewsLoading() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="h-8 w-24 rounded bg-[var(--b70-border)]/60 animate-pulse" />
        <div className="h-4 w-80 rounded bg-[var(--b70-border)]/40 animate-pulse" />
      </header>
      <div className="h-96 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
    </div>
  );
}
