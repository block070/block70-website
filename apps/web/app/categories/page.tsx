import { CATEGORIES } from "@/lib/crypto-mock";

export const metadata = {
  title: "Categories · Block70 Crypto Data",
  description:
    "Mock market categories for majors, aligned with Block70 narratives and liquidity surfaces.",
};

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="text-sm text-slate-400">
          Groupings you&apos;d expect from CoinGecko, tuned for Block70&apos;s
          narrative and liquidity view.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {CATEGORIES.map((category) => (
          <article
            key={category.id}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs"
          >
            <h2 className="text-sm font-semibold text-slate-50">
              {category.name}
            </h2>
            <p className="mt-2 text-slate-400">{category.description}</p>
            <p className="mt-3 text-[11px] text-slate-400">
              Top coins:{" "}
              <span className="text-slate-200">
                {category.topCoins.join(", ")}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Aggregate market cap:{" "}
              <span className="font-medium text-slate-100">
                $
                {Math.round(
                  category.totalMarketCapUsd / 1_000_000_000,
                ).toLocaleString()}
                B
              </span>
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

