/**
 * Curated incident history for the public status page.
 * Edit this file to publish maintenance or outage notices.
 */

export type IncidentSeverity = "minor" | "major" | "critical";

export type StatusIncident = {
  id: string;
  title: string;
  severity: IncidentSeverity;
  /** ISO 8601 */
  startedAt: string;
  /** ISO 8601; omit if ongoing */
  resolvedAt?: string;
  affected: ("api" | "signals" | "ai")[];
  /** Short summary shown in the incident list */
  summary: string;
  /** Chronological updates (newest often shown first in UI) */
  updates: { at: string; message: string }[];
};

export const STATUS_INCIDENTS: StatusIncident[] = [];
