export const metadata = {
  title: "Exchanges · Liquidity & venue activity · Block70",
  description:
    "Liquidity-focused exchange dashboard: 24h volume, trust, heuristic liquidity index, session activity, and venue links. Market depth from CoinGecko tickers on exchange profile pages—not on-chain reserves.",
};

export default function ExchangesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
