export default function DiscoverCategoryLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div className="h-8 w-48 rounded bg-[var(--b70-border)]/60 animate-pulse" />
      <div className="h-32 rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
      <div className="h-24 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
      <div className="h-96 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
    </div>
  );
}
