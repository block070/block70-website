"use client";

import { useEffect, useState } from "react";

import type { CandidateProject } from "@/lib/types";
import { getCandidateProjects } from "@/lib/api";
import { ProjectCard } from "@/components/projects/project-card";

export function ProjectHunterPanel() {
  const [projects, setProjects] = useState<CandidateProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getCandidateProjects(6);
        if (cancelled) return;
        setProjects(data ?? []);
      } catch {
        if (!cancelled) {
          setError(
            "Unable to load candidate projects from the Opportunity Hunter.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        Scanning GitHub and social data for emerging projects…
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-xs text-rose-100">
        {error}
      </section>
    );
  }

  if (!projects.length) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        No candidate projects have been surfaced yet. As the Opportunity Hunter
        picks up new developer and social activity, they&apos;ll appear here.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <h3 className="text-sm font-semibold text-slate-50">
        Opportunity Hunter
      </h3>
      <p className="mt-1 text-[11px] text-slate-400">
        Early-stage projects surfaced from developer and social traction
        before they show up on mainstream radars.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}

