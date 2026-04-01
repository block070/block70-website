import { IntelligenceDashboard } from "@/components/home/intelligence-dashboard";
import { getHomeDashboardPayload } from "@/lib/home/get-cached-home-dashboard";

/** Demo: always SSR so tiles never freeze from stale SSG. Prod: ISR aligned with dashboard cache TTL. */
const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const dynamic = demo ? "force-dynamic" : undefined;
export const revalidate = demo ? undefined : 60;

export const metadata = {
  title: "Trading terminal · Block70",
  description:
    "Block70 Score, live signals, narratives, smart-money flow, and market snapshot — one intelligence surface for opportunity discovery.",
};

export default async function HomePage() {
  const initialData = await getHomeDashboardPayload();
  return <IntelligenceDashboard initialData={initialData} />;
}
