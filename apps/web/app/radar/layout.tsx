import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Radar · Early signals · Block70",
  description:
    "Block70 radar surfaces automated token anomalies and signal clusters before they trend. Scores are experimental—not investment advice. On-device watch alerts optional.",
};

export default function RadarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
