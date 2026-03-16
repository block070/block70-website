import Link from "next/link";
import { notFound } from "next/navigation";

type Params = { params: Promise<{ slug: string }> };

const PLACEHOLDER_ANSWERS: Record<string, { title: string; answer: string }> = {
  "best-ai-tokens-under-1b": {
    title: "Best AI tokens under $1B market cap",
    answer: "AI-generated answer pages can be wired to an LLM or a curated content store. This is a placeholder. Connect to your AI pipeline to display answers with supporting data (e.g. coins list, signals, narratives).",
  },
  "depin-tokens-whales-are-buying": {
    title: "DePIN tokens whales are buying",
    answer: "DePIN tokens that smart wallets are accumulating can be surfaced from wallet activity and capital flows. This page is a placeholder for AI-generated answers with platform data.",
  },
};

export function generateStaticParams() {
  return Object.keys(PLACEHOLDER_ANSWERS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const entry = PLACEHOLDER_ANSWERS[slug];
  if (!entry) return {};
  return {
    title: `${entry.title} · Block70 Q&A`,
    description: entry.answer.slice(0, 160),
  };
}

export default async function QuestionPage({ params }: Params) {
  const { slug } = await params;
  const entry = PLACEHOLDER_ANSWERS[slug];
  if (!entry) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <Link href="/" className="text-sm font-medium text-crypto-blue hover:underline">
        ← Back
      </Link>
      <article>
        <h1 className="text-2xl font-semibold text-[var(--b70-text)]">
          {entry.title}
        </h1>
        <div className="mt-4 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-6 text-sm text-[var(--b70-text-muted)]">
          {entry.answer}
        </div>
      </article>
      <p className="text-xs text-[var(--b70-text-muted)]">
        AI answer pages: route /questions/[slug]. Add an API or LLM to generate answers with supporting data.
      </p>
    </div>
  );
}
