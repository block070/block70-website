import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExchangeBySlug, getExchanges } from "@/lib/api";
import { ExchangeDetailClient } from "./client";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  try {
    const list = await getExchanges();
    return list.slice(0, 50).map((e) => ({ slug: e.slug || e.id }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ex = await getExchangeBySlug(slug).catch(() => null);
  if (!ex) return { title: "Exchange · Block70" };
  return {
    title: `${ex.name} Review, Fees & Volume | Block70`,
    description: `${ex.name} exchange: Trust score ${ex.trust_score}/10, 24h volume $${(ex.trade_volume_24h_usd / 1e9).toFixed(2)}B. Compare fees and features.`,
    openGraph: {
      title: `${ex.name} Review, Fees & Volume | Block70`,
      description: `${ex.name} exchange: Trust score ${ex.trust_score}/10, 24h volume $${(ex.trade_volume_24h_usd / 1e9).toFixed(2)}B.`,
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
