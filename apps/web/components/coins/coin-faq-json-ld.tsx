type Props = {
  name: string;
  symbol: string;
  slug: string;
};

export function CoinFaqJsonLd({ name, symbol, slug }: Props) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What is the current price of ${name} (${symbol})?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${name} (${symbol}) price and 24h change are shown at the top of the Block70 coin page for ${slug}. Data is sourced from aggregated market feeds and may differ slightly from any single exchange.`,
        },
      },
      {
        "@type": "Question",
        name: `What does the Block70 score mean for ${symbol}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `The Block70 score is a 0–100 composite based on momentum and liquidity-style signals derived from public data. It is not a buy/sell recommendation; always do your own research.`,
        },
      },
      {
        "@type": "Question",
        name: `Where can I buy ${symbol}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Major U.S.-accessible venues include Coinbase, Binance.US, and Kraken. Block70 links to third-party sites only; we do not custody assets or execute trades.`,
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
