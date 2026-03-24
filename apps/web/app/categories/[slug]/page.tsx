import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ slug: string }>;
};

/** Canonical category hub lives under /discover; keep /categories/[slug] as a friendly alias. */
export default async function CategorySlugRedirect({ params }: Props) {
  const { slug } = await params;
  redirect(`/discover/${encodeURIComponent(slug)}`);
}
