export default function RadarLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 rounded bg-[var(--b70-border)]/60 animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-64 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
        <div className="h-64 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
      </div>
    </div>
  );
}
