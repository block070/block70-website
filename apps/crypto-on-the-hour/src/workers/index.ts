import "dotenv/config";
import { Worker } from "bullmq";
import { alertSlack } from "../lib/alerting.js";
import { logError, logInfo, logWarn } from "../lib/logger.js";
import { captureWorkerError, initSentry } from "../lib/sentry.js";
import { createRedis } from "../queue/redis.js";
import { getQueue, QUEUE_NAME } from "../queue/queues.js";
import { runHourlyPipeline } from "../pipeline/hourly.runner.js";
import { config } from "../config.js";
import { HOURLY_JOB_NAME, registerHourlyRepeatableJob } from "../scheduler/hourly-schedule.js";

initSentry("worker");

const connection = createRedis();
const queue = getQueue();

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    if (job.name === HOURLY_JOB_NAME) {
      const attempt = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts ?? 1;
      logInfo("worker", "hourly pipeline start", {
        jobId: job.id,
        attempt,
        maxAttempts,
      });

      try {
        const stats = await runHourlyPipeline();
        logInfo("worker", "hourly pipeline done", {
          jobId: job.id,
          stats,
        });
        return stats;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("worker", "hourly pipeline threw", {
          jobId: job.id,
          attempt,
          maxAttempts,
          error: msg,
        });
        captureWorkerError(e, { jobId: job.id, attempt });
        void alertSlack(`${config.pipelineDisplayName} pipeline failed (attempt ${attempt}/${maxAttempts})`, {
          error: msg,
          jobId: String(job.id ?? ""),
        });
        throw e;
      }
    }

    const err = new Error(`unknown job: ${job.name}`);
    logError("worker", err.message, { jobId: job.id });
    throw err;
  },
  {
    connection,
    concurrency: 1,
    maxStalledCount: 2,
  }
);

worker.on("active", (job) => {
  logInfo("worker", "job active", { jobId: job.id, name: job.name });
});

worker.on("completed", (job) => {
  logInfo("worker", "job completed", { jobId: job.id, name: job.name });
});

worker.on("failed", (job, err) => {
  logError("worker", "job failed", {
    jobId: job?.id,
    name: job?.name,
    attemptsMade: job?.attemptsMade,
    error: err.message,
  });
  captureWorkerError(err, {
    jobId: job?.id,
    name: job?.name,
    attemptsMade: job?.attemptsMade,
  });
  void alertSlack("BullMQ job failed (exhausted retries or stalled)", {
    error: err.message,
    jobId: String(job?.id ?? ""),
    attempts: String(job?.attemptsMade ?? ""),
  });
});

worker.on("error", (err) => {
  logError("worker", "worker error", { error: err.message });
});

worker.on("stalled", (jobId) => {
  logWarn("worker", "job stalled", { jobId });
});

registerHourlyRepeatableJob(queue).catch((e) => {
  logError("worker", "failed to register repeatable job", {
    error: e instanceof Error ? e.message : String(e),
  });
});

logInfo("worker", "listening", { queue: QUEUE_NAME });

async function shutdown(signal: string) {
  logInfo("worker", `shutdown (${signal})`);
  await worker.close();
  await queue.close();
  await connection.quit();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
