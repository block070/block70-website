import { notFound } from "next/navigation";

import { WhaleProfileClient } from "@/components/smartwallets/whale-profile-client";
import {
  getWalletActivity,
  getWalletLedgerEvents,
  getWalletPerformance,
} from "@/lib/api";
import { getLiveWallet } from "@/lib/smart-money-live";
import { normalizeWhaleChain, resolveWhaleRow } from "@/lib/whale-resolve";

type Props = { params: { chain: string; address: string } };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SmartwalletProfilePage({ params }: Props) {
  const chain = normalizeWhaleChain(params.chain);
  if (!chain) notFound();

  const address = decodeURIComponent(params.address);
  if (!address) notFound();

  const seed = resolveWhaleRow(chain, address);
  const live = await getLiveWallet(chain, address);

  let performance: Awaited<ReturnType<typeof getWalletPerformance>> | null = null;
  try {
    performance = await getWalletPerformance(address);
  } catch {
    performance = null;
  }

  let activity: Awaited<ReturnType<typeof getWalletActivity>> = {
    wallet_address: address,
    source: "",
    disclaimer: "",
    items: [],
  };
  try {
    activity = await getWalletActivity(address, 40);
  } catch {
    /* keep defaults */
  }

  let ledger: Awaited<ReturnType<typeof getWalletLedgerEvents>> = {
    wallet_address: address,
    source: "",
    items: [],
  };
  try {
    ledger = await getWalletLedgerEvents(address, { limit: 40, chain });
  } catch {
    /* keep defaults */
  }

  return (
    <WhaleProfileClient
      chain={chain}
      address={address}
      seed={seed}
      live={live}
      performance={performance}
      opportunityItems={activity.items}
      ledgerItems={ledger.items}
      activityDisclaimer={activity.disclaimer}
    />
  );
}
