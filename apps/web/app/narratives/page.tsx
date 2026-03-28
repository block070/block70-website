import { getNarrativesIntelligence } from "@/lib/api";
import { NarrativesIntelligenceClient } from "@/components/narratives/narratives-intelligence-client";

export const metadata = {
  title: "Narratives · Block70 Crypto Data",
  description:
    "Real-time narrative intelligence: attention, sentiment proxies, rotation, and related markets.",
};

export const revalidate = 60;

export default async function NarrativesPage() {
  let initial: Awaited<ReturnType<typeof getNarrativesIntelligence>> | null = null;
  try {
    initial = await getNarrativesIntelligence({ limit: 50 });
  } catch {
    initial = null;
  }

  return <NarrativesIntelligenceClient initialData={initial} />;
}
