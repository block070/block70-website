import { WhaleAlertsPanel } from "@/components/smartwallets/whale-alerts-panel";

export const metadata = {
  title: "Whale alerts · Block70",
  description: "Configure local presets for major move alerts; integrate with Block70 notifications when signed in.",
};

export default function SmartwalletsAlertsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[var(--b70-text)]">Alerts</h1>
        <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
          Major moves and flow presets. Device-local toggles; connect to your account alerts for delivery.
        </p>
      </header>
      <WhaleAlertsPanel />
    </div>
  );
}
