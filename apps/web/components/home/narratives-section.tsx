export function NarrativesSection() {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-50">
            Narratives
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Themes will appear here once the narratives engine has detected
            clusters across tokens and chains.
          </p>
        </div>
      </div>
    </section>
  );
}
