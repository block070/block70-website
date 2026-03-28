import { NarrativesIntelligenceClient } from "@/components/narratives/narratives-intelligence-client";
import { getNarrativesIntelligenceForServer } from "@/lib/get-narratives-intelligence-server";

export const metadata = {
  title: "Narratives · Block70 Crypto Data",
  description:
    "Real-time narrative intelligence: attention, sentiment proxies, rotation, and related markets.",
};

export const dynamic = "force-dynamic";

export default async function NarrativesPage() {
  let initial: Awaited<
    ReturnType<typeof getNarrativesIntelligenceForServer>
  > | null = null;
  try {
    initial = await getNarrativesIntelligenceForServer({ limit: 50 });
  } catch {
    initial = null;
  }

  return <NarrativesIntelligenceClient initialData={initial} />;
}
