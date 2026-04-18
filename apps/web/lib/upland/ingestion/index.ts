// Ingestion orchestrator -- drives the end-to-end sync:
//
//   1. Acquire a Redis-backed lock (or a per-process lock fallback) so two
//      triggers can't clobber each other.
//   2. Record an ingestion_runs row with status=running.
//   3. Iterate the PropertySource, upsert each page in a per-row transaction,
//      emit change_events inline.
//   4. Refresh property_search_view (and city_stats_view) CONCURRENTLY.
//   5. Invalidate the upland cache prefix so readers see fresh data next hit.
//   6. Finalize the ingestion_runs row.
//
// The caller (the /api/upland/ingest/trigger route) is responsible for:
//   * Auth (verify X-Upland-Ingest-Secret header against env).
//   * Kicking downstream webhook fan-out (n8n reads from change_events).

import { uplandPrisma } from "../db";
import { invalidateUplandCache } from "../cache";
import { createSource, type SourceName } from "./sources";
import { upsertNormalizedProperty } from "./upsert";
import { ingestionLogger } from "./logger";

export type IngestionTriggerOptions = {
  source?: SourceName;
  maxPages?: number;
  /** Short-circuit lock acquisition -- used by the n8n drift guard's recompute path. */
  skipLock?: boolean;
};

export type IngestionRunSummary = {
  runId: string;
  source: string;
  status: "ok" | "error" | "locked";
  propertiesSeen: number;
  propertiesUpserted: number;
  propertiesCreated: number;
  changeEvents: number;
  startedAt: string;
  finishedAt: string | null;
  error?: string;
};

const LOCK_KEY = "upland:ingestion:lock";
const LOCK_TTL_SECONDS = 60 * 15; // 15 minutes: generous upper bound for a run.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redisLockClient: any = null;
function getRedisLockClient():
  | { acquire: () => Promise<boolean>; release: () => Promise<void> }
  | null {
  if (redisLockClient) return redisLockClient;
  const url = process.env.REDIS_URL;
  if (!url || url.trim().length === 0) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const IORedis = require("ioredis");
    const client = new IORedis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
    const lockValue = `${process.pid}-${Date.now()}`;
    redisLockClient = {
      async acquire(): Promise<boolean> {
        const res = await client.set(LOCK_KEY, lockValue, "NX", "EX", LOCK_TTL_SECONDS);
        return res === "OK";
      },
      async release(): Promise<void> {
        const current = await client.get(LOCK_KEY);
        if (current === lockValue) await client.del(LOCK_KEY);
      },
    };
    return redisLockClient;
  } catch {
    return null;
  }
}

// Fallback: per-process lock for environments without Redis (dev/CI). Not safe
// across instances, but neither is the whole ingestion layer in that mode.
let localLockHeld = false;
const localLock = {
  async acquire(): Promise<boolean> {
    if (localLockHeld) return false;
    localLockHeld = true;
    return true;
  },
  async release(): Promise<void> {
    localLockHeld = false;
  },
};

export async function runIngestion(
  opts: IngestionTriggerOptions = {},
): Promise<IngestionRunSummary> {
  const startedAt = new Date();
  const source = createSource(opts.source);
  const lock = opts.skipLock ? null : (getRedisLockClient() ?? localLock);

  if (lock) {
    const acquired = await lock.acquire();
    if (!acquired) {
      ingestionLogger.warn("ingestion skipped: lock held", { source: source.name });
      return {
        runId: "skipped-lock",
        source: source.name,
        status: "locked",
        propertiesSeen: 0,
        propertiesUpserted: 0,
        propertiesCreated: 0,
        changeEvents: 0,
        startedAt: startedAt.toISOString(),
        finishedAt: null,
      };
    }
  }

  const run = await uplandPrisma.ingestionRun.create({
    data: {
      source: source.name,
      startedAt,
      status: "running",
    },
  });

  ingestionLogger.info("ingestion start", { runId: run.id, source: source.name });

  let seen = 0;
  let upserted = 0;
  let created = 0;
  let changeEvents = 0;

  try {
    for await (const page of source.pages({ maxPages: opts.maxPages })) {
      seen += page.items.length;
      for (const item of page.items) {
        const outcome = await upsertNormalizedProperty(uplandPrisma, item, run.id);
        if (outcome.created) created += 1;
        if (outcome.updated || outcome.created) upserted += 1;
        changeEvents += outcome.changeEvents.length;
      }
      ingestionLogger.info("ingestion page", {
        runId: run.id,
        source: source.name,
        pageItems: page.items.length,
        cursor: page.cursor,
      });
      if (!page.cursor) break;
    }

    // Refresh mat views + cache invalidation.
    await refreshMaterializedViews();
    await invalidateUplandCache();

    const finishedAt = new Date();
    await uplandPrisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "ok",
        finishedAt,
        propertiesSeen: seen,
        propertiesUpserted: upserted,
      },
    });
    ingestionLogger.info("ingestion ok", {
      runId: run.id,
      seen,
      upserted,
      created,
      changeEvents,
    });

    return {
      runId: run.id,
      source: source.name,
      status: "ok",
      propertiesSeen: seen,
      propertiesUpserted: upserted,
      propertiesCreated: created,
      changeEvents,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await uplandPrisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: "error", finishedAt: new Date(), error: msg },
    });
    ingestionLogger.error("ingestion error", { runId: run.id, error: msg });
    return {
      runId: run.id,
      source: source.name,
      status: "error",
      propertiesSeen: seen,
      propertiesUpserted: upserted,
      propertiesCreated: created,
      changeEvents,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      error: msg,
    };
  } finally {
    if (lock) {
      try {
        await lock.release();
      } catch (err) {
        ingestionLogger.warn("lock release failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

async function refreshMaterializedViews(): Promise<void> {
  // CONCURRENTLY requires a unique index on the mat view; the raw SQL migration
  // creates one. If that index is missing Postgres will error out cleanly.
  await uplandPrisma.$executeRawUnsafe(
    "REFRESH MATERIALIZED VIEW CONCURRENTLY property_search_view",
  );
  await uplandPrisma.$executeRawUnsafe(
    "REFRESH MATERIALIZED VIEW CONCURRENTLY city_stats_view",
  );
}
