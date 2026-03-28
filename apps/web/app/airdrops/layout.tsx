import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rewards discovery · Block70",
  description:
    "Explore airdrops and incentive programs as a discovery hub — not financial advice. Checklists and alerts are on-device experiments; always verify official links.",
};

export default function AirdropsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
