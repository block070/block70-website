import { WhaleDirectoryTable } from "@/components/smartwallets/whale-directory-table";
import { loadWhaleDirectory } from "@/lib/smartwallets-server";

export const metadata = {
  title: "Whale intelligence · Block70",
  description:
    "Smart money directory: performance proxies, chains, and wallet profiles. Informational only—not financial advice.",
};

export const revalidate = 60;

export default async function SmartwalletsHubPage() {
  const rows = await loadWhaleDirectory();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
          Whale intelligence
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">Smart money directory</h1>
        <p className="max-w-2xl text-sm text-[var(--b70-text-muted)]">
          Track wallet-level performance signals and drill into holdings-style tabs, on-chain ledger (when
          indexed), and opportunity-derived activity. Inspired by professional labeling platforms—without
          implying endorsement of any address.
        </p>
      </header>
      <WhaleDirectoryTable rows={rows} />
    </div>
  );
}
