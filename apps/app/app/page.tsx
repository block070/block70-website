import { Card } from "@ui";

export default async function AppHome() {
  return (
    <div className="space-y-6">
      <Card title="Block70 Dashboard">
        <p className="mt-1 text-sm text-slate-300">
          This application hosts the authenticated dashboard, portfolio tracker,
          AI search, strategies, and alerts. It consumes the same FastAPI
          backend APIs as the public website but focuses on logged-in workflows.
        </p>
      </Card>
    </div>
  );
}

