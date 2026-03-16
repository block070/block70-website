import { getCandidateProjects } from "@/lib/api";
import type { CandidateProject } from "@/lib/types";
import { ProjectCard } from "@/components/projects/project-card";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  let projects: CandidateProject[] = [];
  let error: string | null = null;

  try {
    projects = await getCandidateProjects(50);
  } catch {
    error =
      "Unable to load candidate projects from the backend right now. Please try again shortly.";
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-50">
          Project Discovery
        </h2>
        <p className="text-xs text-slate-400">
          Early-stage crypto projects surfaced by the Opportunity Hunter based
          on developer and social traction.
        </p>
      </header>

      {error ? (
        <section className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-xs text-rose-100">
          {error}
        </section>
      ) : projects.length === 0 ? (
        <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
          No candidate projects have been detected yet. As the Opportunity
          Hunter scans GitHub and social data, promising projects will appear
          here.
        </section>
      ) : (
        <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </section>
      )}
    </div>
  );
}

