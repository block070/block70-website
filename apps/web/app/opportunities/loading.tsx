export default function OpportunitiesLoading() {
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-slate-800" />
          <div className="h-3 w-56 rounded bg-slate-900" />
        </div>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex flex-wrap gap-3 text-xs">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="flex flex-col gap-1">
              <div className="h-3 w-20 rounded bg-slate-800" />
              <div className="h-8 w-28 rounded-md bg-slate-900" />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {Array.from({ length: 4 }).map((_, idx) => (
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

