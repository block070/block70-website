import Link from "next/link";
import { getCoinBySlugOrMock } from "@/lib/coins";
import { notFound } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { TokenDiscussionFeed } from "@/components/coins/token-discussion-feed";
import { withTimeout } from "@/lib/with-timeout";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  try {
    const data = await getCoinBySlugOrMock(slug);
    return {
      title: `${data.coin.symbol} Community · Block70`,
      description: `Discussion and comments for ${data.coin.name} (${data.coin.symbol}).`,
    };
  } catch {
    return {};
  }
}

const FETCH_TIMEOUT_MS = 8_000;

export default async function CoinCommunityPage({ params }: Params) {
  const { slug } = await params;
  let coin;
  try {
    const data = await withTimeout(getCoinBySlugOrMock(slug), FETCH_TIMEOUT_MS);
    coin = data.coin;
  } catch {
    notFound();
  }
  const symbol = coin.symbol.toUpperCase();

  const commentsUrl = `${API_BASE_URL}/api/v1/tokens/${encodeURIComponent(symbol)}/comments`;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--b70-text)]">
            {coin.name} ({coin.symbol}) — Community
          </h1>
          <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
            Comments and discussion for this token.
          </p>
        </div>
        <Link
          href={`/coins/${slug}`}
          className="text-sm font-medium text-crypto-blue hover:underline"
        >
          ← Coin page
        </Link>
      </section>

      <TokenDiscussionFeed tokenSymbol={symbol} commentsUrl={commentsUrl} />
    </div>
  );
}
