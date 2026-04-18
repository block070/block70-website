export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8">
      <div className="h-8 w-64 animate-pulse rounded bg-[var(--b70-surface)]" />
      <div className="mt-6 grid grid-cols-[260px,1fr] gap-6">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-[var(--b70-surface)]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded bg-[var(--b70-surface)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
