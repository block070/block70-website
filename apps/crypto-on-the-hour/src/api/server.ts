import Fastify from "fastify";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { getQueue } from "../queue/queues.js";
import { query } from "../db/pool.js";
import { getCoinSignals, getTopicsForHourBucket } from "../modules/signals/coin-signals.service.js";
import { getPipelineHealth } from "../modules/health/pipeline-health.js";

export async function buildServer() {
  const app = Fastify({ logger: true });

  /** Process is up; use for load balancers. Does not check DB/Redis. */
  app.get("/health/live", async () => ({ ok: true, service: config.pipelineSlug }));

  /** Liveness + Postgres (can hang if DATABASE_URL is wrong or DB unreachable). */
  app.get("/health", async () => {
    await pool.query("SELECT 1");
    return { ok: true, service: config.pipelineSlug };
  });

  app.get("/health/pipeline", async (req, reply) => {
    try {
      const h = await getPipelineHealth();
      if (!h.ok) return reply.code(503).send(h);
      return h;
    } catch (e) {
      req.log.error(e);
      return reply.code(500).send({ ok: false, error: "pipeline health check failed" });
    }
  });

  /** Coin-page intelligence: topics, sentiment, mentions (mentioned_assets overlap only). */
  app.get<{ Params: { symbol: string } }>("/signals/coin/:symbol", async (req, reply) => {
    const symbol = req.params.symbol;
    if (!symbol || symbol.length > 32) return reply.code(400).send({ error: "invalid symbol" });
    try {
      const data = await getCoinSignals(symbol);
      return data;
    } catch (e) {
      req.log.error(e);
      return reply.code(500).send({ error: "failed to load coin signals" });
    }
  });

  /** Hourly snapshot for /crypto-on-the-hour/:timestamp (unix sec = UTC hour start). */
  app.get<{ Params: { hour: string } }>("/content/hour/:hour", async (req, reply) => {
    const hour = parseInt(req.params.hour, 10);
    if (!Number.isFinite(hour) || hour <= 0) return reply.code(400).send({ error: "invalid hour timestamp" });
    try {
      const data = await getTopicsForHourBucket(hour);
      if (!data) return reply.code(400).send({ error: "invalid hour" });
      return data;
    } catch (e) {
      req.log.error(e);
      return reply.code(500).send({ error: "failed to load hour" });
    }
  });

  app.get("/content/topics", async (req, reply) => {
    const limit = Math.min(parseInt((req.query as { limit?: string }).limit ?? "20", 10), 100);
    const r = await query(
      `SELECT id, headline, rank_score::float, status, last_updated_at
       FROM topics ORDER BY last_updated_at DESC LIMIT $1`,
      [limit]
    );
    return { topics: r.rows };
  });

  app.get("/content/topics/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const t = await query(`SELECT * FROM topics WHERE id = $1`, [id]);
    if (t.rowCount === 0) return reply.code(404).send({ error: "not found" });
    const c = await query(`SELECT kind, title, body, meta, created_at FROM content_pieces WHERE topic_id = $1`, [
      id,
    ]);
    return { topic: t.rows[0], content: c.rows };
  });

  app.post("/admin/trigger-hourly", async (req, reply) => {
    const secret = (req.headers as { "x-admin-secret"?: string })["x-admin-secret"];
    const expected = process.env.ADMIN_TRIGGER_SECRET;
    if (expected && secret !== expected) return reply.code(401).send({ error: "unauthorized" });
    await getQueue().add("hourly", {}, { jobId: `manual-${Date.now()}` });
    return { queued: true };
  });

  return app;
}

export async function listen() {
  const app = await buildServer();
  await app.listen({ host: config.apiHost, port: config.apiPort });
}
