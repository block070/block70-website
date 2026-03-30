import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trader leaderboard · Block70",
  description:
    "Competitive rankings by simulated strategy ROI and win rate. Explore top performers, time windows, and Blocks standings — for discovery, not financial advice.",
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
