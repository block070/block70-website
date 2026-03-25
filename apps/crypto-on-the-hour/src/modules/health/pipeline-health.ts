import { query } from "../../db/pool.js";

export type PipelineHealth = {
  ok: boolean;
  lastRun: { startedAt: string; status: string; finishedAt: string | null } | null;
  staleHours: number | null;
};

/** Flag stale if last successful run finished more than ~2h ago. */
export async function getPipelineHealth(): Promise<PipelineHealth> {
  const r = await query<{ started_at: Date; finished_at: Date | null; status: string }>(
    `SELECT started_at, finished_at, status
     FROM pipeline_runs
     ORDER BY started_at DESC
     LIMIT 1`
  );
  const row = r.rows[0];
  if (!row) {
    return { ok: false, lastRun: null, staleHours: null };
  }

  const lastRun = {
    startedAt:
      row.started_at instanceof Date ? row.started_at.toISOString() : new Date(row.started_at).toISOString(),
    status: row.status,
    finishedAt: row.finished_at
      ? row.finished_at instanceof Date
        ? row.finished_at.toISOString()
        : new Date(row.finished_at).toISOString()
      : null,
  };

  if (row.status !== "ok" || !row.finished_at) {
    return { ok: false, lastRun, staleHours: null };
  }

  const finished = row.finished_at instanceof Date ? row.finished_at : new Date(row.finished_at);
  const hours = (Date.now() - finished.getTime()) / 3_600_000;
  const ok = hours < 2.5;
  return { ok, lastRun, staleHours: Math.round(hours * 10) / 10 };
}
