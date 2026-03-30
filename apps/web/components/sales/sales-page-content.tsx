import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SalesSection } from "@/components/sales/sales-section";
import { PAYWALL_COPY } from "@/lib/paywall-copy";

function TerminalMock() {
  return (
    <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-lg transition-transform duration-300 hover:-translate-y-0.5">
      <div className="flex items-center gap-2 border-b border-[var(--b70-border)] pb-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
        <span className="h-2 w-2 rounded-full bg-amber-500/80" />
        <span className="h-2 w-2 rounded-full bg-slate-500/60" />
        <span className="ml-2 font-mono text-[10px] text-[var(--b70-text-muted)]">block70 · desk</span>
      </div>
      <div className="mt-4 space-y-2 font-mono text-[11px] text-[var(--b70-text-muted)]">
        <p>
          <span className="text-[var(--b70-crypto-blue)]">OPP</span> BTC · score{" "}
          <span className="text-emerald-400">88</span> · tier strong
        </p>
        <p>
          <span className="text-[var(--b70-crypto-blue)]">FLOW</span> smart $ in L2 · 2.1M
        </p>
        <p>
          <span className="text-[var(--b70-crypto-blue)]">SIG</span> high conf · ETH · +Δ
        </p>
        <div className="mt-3 h-16 rounded-lg bg-[var(--b70-bg)] bg-[linear-gradient(90deg,var(--b70-crypto-blue)_0%,transparent_70%)] opacity-40" />
      </div>
    </div>
  );
}

const FAQ = [
  {
    q: "Is this financial advice?",
    a: "No. Block70 surfaces data and scores for research. You are responsible for your own decisions and compliance.",
  },
  {
    q: "Can I start without a card?",
    a: "Yes. The Free tier lets you explore. Upgrade when you need full score breakdowns, dense signals, or the API.",
  },
  {
    q: "What happens if I cancel?",
    a: "You keep access through the paid period, then revert to Free. API keys for Quant follow your subscription status.",
  },
];

export function SalesPageContent() {
  return (
    <article className="text-[var(--b70-text)]">
      <header className="border-b border-[var(--b70-border)] pb-16 pt-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--b70-crypto-blue)]">
          Block70
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl md:leading-tight">
          Stop trading the headline. Start trading the{" "}
          <span className="text-[var(--b70-crypto-blue)]">signal stack</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-[var(--b70-text-muted)] md:text-base">
          Retail dashboards show price. Desks need scores, flows, narratives, and opportunity context in one
          surface — without Tab Apocalypse. {PAYWALL_COPY.subSmartMoney}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/pricing">
            <Button className="bg-[var(--b70-crypto-blue)] text-white hover:opacity-90">View pricing</Button>
          </Link>
          <Link href="/register?next=/product">
            <Button variant="outline">Create free account</Button>
          </Link>
        </div>
      </header>

      <SalesSection kicker="01" title="The problem" id="pain">
        <ul className="max-w-2xl space-y-4 text-sm leading-relaxed text-[var(--b70-text-muted)]">
          <li>Too many tabs: signals in one place, wallets in another, narratives buried in Discord.</li>
          <li>Delayed or shallow “scores” that don’t explain drivers — so you can’t size conviction.</li>
          <li>Free feeds optimized for engagement, not execution — you see noise before edge.</li>
        </ul>
      </SalesSection>

      <SalesSection kicker="02" title="The solution" id="solution">
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--b70-text-muted)]">
          Block70 is a trading-terminal style intelligence layer: Block70 Score tiers, narrative engine,
          smart-money flows, and signals in a single command surface. Upgrade when you need full breakdowns and
          API-grade depth.
        </p>
      </SalesSection>

      <SalesSection kicker="03" title="What you get" id="value">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              t: "Block70 Score",
              d: "Surface scores everywhere; unlock factor-level breakdown on Elite+.",
            },
            { t: "Signals rail", d: "Tiered feeds from discovery to dense, real-time context." },
            { t: "Smart money", d: "Directory and flow chips tied to opportunity themes." },
            { t: "AI + API", d: "Rising AI limits on Pro; Quant for automation and keys." },
          ].map((x) => (
            <div
              key={x.t}
              className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--b70-crypto-blue)]/30"
            >
              <h3 className="font-semibold text-[var(--b70-text)]">{x.t}</h3>
              <p className="mt-2 text-sm text-[var(--b70-text-muted)]">{x.d}</p>
            </div>
          ))}
        </div>
      </SalesSection>

      <SalesSection kicker="04" title="Inside the terminal" id="demo">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <TerminalMock />
          <div className="space-y-3 text-sm text-[var(--b70-text-muted)]">
            <p>
              Your homepage and desk views mirror how operators work: best opportunity and score on the left,
              market snapshot center, smart money on the right.
            </p>
            <p>Placeholder visuals — swap for product shots or a short loop when ready.</p>
          </div>
        </div>
      </SalesSection>

      <SalesSection kicker="05" title="Objections" id="faq">
        <dl className="mx-auto max-w-2xl space-y-6">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="font-medium text-[var(--b70-text)]">{item.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-[var(--b70-text-muted)]">{item.a}</dd>
            </div>
          ))}
        </dl>
      </SalesSection>

      <SalesSection kicker="06" title="Start with edge on your terms" id="urgency">
        <p className="max-w-2xl text-sm text-[var(--b70-text-muted)]">
          Try Free, then Pro for faster feeds, or Elite when you need full score intelligence and dense
          signals. Quant when automation matters. No fake countdowns — upgrade when your process outgrows the
          free rail.
        </p>
      </SalesSection>

      <section className="border-t border-[var(--b70-border)] py-16">
        <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-[var(--b70-card)] to-[var(--b70-card)] p-8 text-center shadow-lg">
          <h2 className="text-xl font-semibold text-[var(--b70-text)] md:text-2xl">
            {PAYWALL_COPY.headlineDetected}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--b70-text-muted)]">
            {PAYWALL_COPY.subUpgrade}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/pricing">
              <Button className="bg-amber-500 text-slate-950 hover:bg-amber-400">See plans</Button>
            </Link>
            <Link href="/register?next=/pricing">
              <Button variant="outline">Get started free</Button>
            </Link>
          </div>
        </div>
      </section>
    </article>
  );
}
