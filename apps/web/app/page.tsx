import { IntelligenceDashboard } from "@/components/home/intelligence-dashboard";

export const metadata = {
  title: "Trading terminal · Block70",
  description:
    "Block70 Score, live signals, narratives, smart-money flow, and market snapshot — one intelligence surface for opportunity discovery.",
};

export default function HomePage() {
  return <IntelligenceDashboard />;
}
