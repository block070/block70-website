"use client";

/** No fabricated metrics — narrative trust strip only until a real stats endpoint exists. */

export function PricingSocialProof({ className }: { className?: string }) {
  return (
    <section
      className={`rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] px-6 py-8 ${className ?? ""}`}
    >
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-text-muted)]">
        Built for signal, not noise
      </p>
      <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-[var(--b70-text-muted)]">
        Block70 is designed for operators who want structured opportunity context — scores, flows, and
        narratives — without scrolling endless feeds. Start free, scale to a desk-grade stack when you
        are ready.
      </p>
      <ul className="mx-auto mt-6 flex max-w-xl flex-col gap-3 text-xs text-[var(--b70-text-muted)] sm:flex-row sm:justify-center sm:gap-8">
        <li className="flex items-start gap-2 sm:flex-col sm:items-center sm:text-center">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--b70-crypto-blue)] sm:mt-0" />
          <span>Terminal-style layouts for faster decisions</span>
        </li>
        <li className="flex items-start gap-2 sm:flex-col sm:items-center sm:text-center">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--b70-crypto-blue)] sm:mt-0" />
          <span>Gating aligned with real API enforcement</span>
        </li>
        <li className="flex items-start gap-2 sm:flex-col sm:items-center sm:text-center">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--b70-crypto-blue)] sm:mt-0" />
          <span>Upgrade only when you need depth</span>
        </li>
      </ul>
    </section>
  );
}
