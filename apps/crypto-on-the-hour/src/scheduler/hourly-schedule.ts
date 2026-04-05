/**
 * BullMQ repeatable job registration — crypto pipeline on a cron schedule.
 */
import type { Queue } from "bullmq";
import { config } from "../config.js";
import { getDefaultJobOptions } from "../queue/queues.js";
import { logInfo } from "../lib/logger.js";

/** @deprecated Use `config.pipelineCronPattern` (env `PIPELINE_CRON_PATTERN`). */
export const HOURLY_CRON_PATTERN = "0 * * * *";

export const HOURLY_JOB_NAME = "hourly";

/** Stable id so repeat config does not duplicate across restarts. */
export const HOURLY_REPEAT_JOB_ID = `repeat-hourly-${config.pipelineSlug}`;

export async function registerHourlyRepeatableJob(queue: Queue): Promise<void> {
  const pattern = config.pipelineCronPattern.trim() || HOURLY_CRON_PATTERN;
  const existing = await queue.getRepeatableJobs();
  for (const r of existing) {
    if (r.name === HOURLY_JOB_NAME) {
      await queue.removeRepeatableByKey(r.key);
      logInfo("scheduler", "removed previous repeatable pipeline job", {
        key: r.key,
        pattern: r.pattern,
      });
    }
  }

  const defaults = getDefaultJobOptions();
  await queue.add(
    HOURLY_JOB_NAME,
    {},
    {
      ...defaults,
      repeat: { pattern, tz: config.pipelineCronTz },
      jobId: HOURLY_REPEAT_JOB_ID,
    }
  );
  logInfo("scheduler", "registered repeatable pipeline job", {
    pattern,
    tz: config.pipelineCronTz,
  });
}
