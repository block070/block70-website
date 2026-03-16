export const metadata = {
  title: "News · Block70 Crypto Data",
  description:
    "Mock news surface that will later be ranked and summarized by Block70’s intelligence engine.",
};

const MOCK_NEWS = [
  {
    id: 1,
    title: "Flagship L2 announces incentive extension",
    source: "Block70 Macro Feed",
    timeAgo: "2h ago",
    summary:
      "An L2 chain extends ecosystem incentives, pulling in more TVL and on-chain activity.",
  },
  {
    id: 2,
    title: "New Solana perp DEX surpasses $1B daily volume",
    source: "DEX Radar",
    timeAgo: "5h ago",
    summary:
      "A high-performance Solana DEX quickly climbs the volume ranks, driven by perps.",
  },
  {
    id: 3,
    title: "Restaking primitive hits mainnet with guarded launch",
    source: "Validator Watch",
    timeAgo: "12h ago",
    summary:
      "A new restaking protocol deploys with caps, sparking early experimentation.",
  },
];

export default function NewsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">News</h1>
        <p className="text-sm text-slate-400">
          A curated macro surface that will later be enriched by Block70&apos;s
          AI summarization and opportunity tagging.
        </p>
      </header>
      <div className="space-y-3">
        {MOCK_NEWS.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-50">
                {item.title}
              </h2>
              <span className="text-[11px] text-slate-500">
                {item.timeAgo}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {item.source}
            </p>
            <p className="mt-2 text-slate-300">{item.summary}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

