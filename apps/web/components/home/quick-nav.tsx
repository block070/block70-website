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
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <h3 className="text-sm font-semibold text-slate-50">Quick navigation</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="flex flex-col rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm transition-colors hover:border-blue-500/50 hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <span className="font-medium text-slate-100">{card.label}</span>
            <span className="mt-0.5 text-[11px] text-slate-400">
              {card.description}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
