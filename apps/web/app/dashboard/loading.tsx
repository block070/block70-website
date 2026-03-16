export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <section>
        <div className="h-4 w-40 rounded bg-slate-800" />
        <div className="mt-2 h-3 w-64 rounded bg-slate-900" />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="animate-pulse rounded-xl border border-slate-800 bg-slate-950/60 p-4"
          >
            <div className="h-3 w-24 rounded bg-slate-800" />
            <div className="mt-3 h-5 w-20 rounded bg-slate-700" />
            <div className="mt-2 h-3 w-32 rounded bg-slate-900" />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="h-3 w-32 rounded bg-slate-800" />
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="animate-pulse rounded-xl border border-slate-800 bg-slate-950/60 p-4"
          >
            <div className="flex justify-between gap-4">
              <div className="space-y-2">
                <div className="h-3 w-24 rounded bg-slate-800" />
                <div className="h-4 w-48 rounded bg-slate-800" />
                <div className="h-3 w-64 rounded bg-slate-900" />
              </div>
              <div className="space-y-2 text-right">
                <div className="h-3 w-20 rounded bg-slate-800" />
                <div className="h-5 w-16 rounded bg-slate-800" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="h-3 w-40 rounded bg-slate-900" />
              <div className="h-6 w-28 rounded-full bg-slate-900" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

