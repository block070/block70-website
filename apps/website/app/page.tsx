import { Button, Card } from "@ui";

export default function MarketingHome() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-3xl text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">
          Block70 Alpha Network
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          Where is the easiest money in crypto right now?
        </h1>
        <p className="mt-4 text-sm text-slate-300 md:text-base">
          Block70 is a crypto opportunity intelligence platform that surfaces
          high-signal alpha across arbitrage, miner/node ROI, airdrops, and
          smart wallets. The website is your public-facing launchpad; the app is
          where power users operate.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button asChild>
            <a href="https://app.block70.localhost">Open Block70 App</a>
          </Button>
          <Button variant="secondary" asChild>
            <a href="#product">Learn how it works</a>
          </Button>
        </div>

        <div id="product" className="mt-12 text-left">
          <Card title="Public website">
            <p>
              The Block70 website focuses on SEO pages, public signals, token
              pages, discover views, and articles to help new users understand
              the product. All authenticated dashboards and tools live in the
              separate Block70 app.
            </p>
          </Card>
        </div>
      </div>
    </main>
  );
}

