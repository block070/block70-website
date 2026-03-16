import { AlphaIntelligencePanel } from "@/components/dashboard/alpha-intelligence-panel";
import { OpportunityInsightFeed } from "@/components/dashboard/opportunity-insight-feed";
import { AlphaFeed } from "@/components/dashboard/alpha-feed";
import { RadarPanel } from "@/components/dashboard/radar-panel";
import { ProjectHunterPanel } from "@/components/dashboard/project-hunter-panel";
import { DailyBriefingPanel } from "@/components/dashboard/daily-briefing";

export default function AlphaPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-lg font-semibold text-slate-50">
          Alpha Intelligence
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Unified view of Block70&apos;s Alpha engines: ranked opportunities,
          radar clusters, AI research, and real-time signals.
        </p>
      </section>

      <section>
        <AlphaIntelligencePanel />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <OpportunityInsightFeed />
        <RadarPanel />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <AlphaFeed />
        <ProjectHunterPanel />
      </section>

      <section>
        <DailyBriefingPanel />
      </section>
    </div>
  );
}

