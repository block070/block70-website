import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExchangeBySlug } from "@/lib/api";
import { ExchangeDetailClient } from "./client";

type Props = { params: Promise<{ slug: string }> };

/** Avoid build-time API calls (Docker `next build` has no fast path to live API → SSG timeout). */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ex = await getExchangeBySlug(slug).catch(() => null);
  if (!ex) return { title: "Exchange · Block70" };
  const volNote =
    ex.trade_volume_24h_usd >= 1e9
      ? `$${(ex.trade_volume_24h_usd / 1e9).toFixed(2)}B`
      : ex.trade_volume_24h_usd >= 1e6
        ? `$${(ex.trade_volume_24h_usd / 1e6).toFixed(2)}M`
        : `$${(ex.trade_volume_24h_usd / 1e3).toFixed(0)}K`;
  return {
    title: `${ex.name} · Liquidity & markets | Block70`,
    description: `${ex.name}: trust ${ex.trust_score}/10, ~${volNote} 24h volume (CoinGecko). Profile includes volume history, top markets, and spread proxy—data via CoinGecko.`,
    openGraph: {
      title: `${ex.name} · Liquidity & markets | Block70`,
      description: `${ex.name}: trust ${ex.trust_score}/10, ~${volNote} 24h volume (CoinGecko).`,
    },
  };
}

export default async function ExchangeSlugPage({ params }: Props) {
  const { slug } = await params;
  const ex = await getExchangeBySlug(slug).catch(() => null);
  if (!ex) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ex.name,
    url: ex.url,
    description: `Cryptocurrency exchange: Trust score ${ex.trust_score}/10, 24h volume $${(ex.trade_volume_24h_usd / 1e9).toFixed(2)}B`,
    ...(ex.country && { address: { "@type": "PostalAddress", addressCountry: ex.country } }),
    ...(ex.year_established && { foundingDate: String(ex.year_established) }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ExchangeDetailClient exchange={ex} />
    </>
  );
}
