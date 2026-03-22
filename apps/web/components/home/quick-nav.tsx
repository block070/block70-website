import Link from "next/link";

const CARDS = [
  { href: "/signals", label: "Signals", description: "Live signal feed" },
  { href: "/opportunities", label: "Opportunities", description: "Top alpha plays" },
  { href: "/airdrops", label: "Airdrops", description: "Active & upcoming" },
  { href: "/wallets", label: "Wallet Tracker", description: "Smart money" },
  { href: "/narratives", label: "Narratives", description: "Trending themes" },
];

export function QuickNav() {
  return (
    <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[var(--b70-text)]">Quick navigation</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="flex flex-col rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] p-3 text-sm transition-colors hover:border-blue-500/50 hover:bg-slate-200/80 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-800/60"
          >
            <span className="font-medium text-[var(--b70-text)]">{card.label}</span>
            <span className="mt-0.5 text-[11px] text-[var(--b70-text-muted)]">
              {card.description}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
