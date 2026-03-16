export default function OpportunityDetailLoading() {
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-56 rounded bg-slate-800" />
          <div className="h-3 w-40 rounded bg-slate-900" />
        </div>
        <div className="h-6 w-32 rounded-full bg-slate-900" />
      </header>

      <section className="grid gap-4 md:grid-cols-[2fr,1.2fr]">
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-slate-800" />
            <div className="h-4 w-64 rounded bg-slate-900" />
            <div className="h-4 w-72 rounded bg-slate-900" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-20 rounded bg-slate-800" />
            <div className="h-4 w-64 rounded bg-slate-900" />
            <div className="h-4 w-64 rounded bg-slate-900" />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="h-3 w-28 rounded bg-slate-800" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="space-y-1">
                <div className="h-2 w-20 rounded bg-slate-900" />
                <div className="h-3 w-24 rounded bg-slate-800" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="h-3 w-32 rounded bg-slate-800" />
        <div className="mt-2 h-3 w-64 rounded bg-slate-900" />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <div className="h-2 w-20 rounded bg-slate-900" />
              <div className="h-4 w-12 rounded bg-slate-800" />
              <div className="h-3 w-32 rounded bg-slate-900" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

