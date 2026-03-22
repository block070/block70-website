export default function CoinDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-24 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
      <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="h-64 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
        <div className="h-48 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
      </div>
    </div>
  );
}
