import Link from "next/link";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }> | { slug: string };
};

export default async function CoinSlugLayout({
  children,
  params,
}: LayoutProps) {
  const { slug } = await Promise.resolve(params);

  return (
    <div className="space-y-4">
      <nav className="flex gap-2 border-b border-slate-800 pb-2">
        <Link
          href={`/coins/${slug}`}
          className="rounded px-3 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          Overview
        </Link>
        <Link
          href={`/coins/${slug}/community`}
          className="rounded px-3 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          Community
        </Link>
        <Link
          href={`/coins/${slug}/insights`}
          className="rounded px-3 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          AI Insights
        </Link>
      </nav>
      {children}
    </div>
  );
}
