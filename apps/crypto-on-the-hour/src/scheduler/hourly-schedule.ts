/**
 * BullMQ repeatable job registration — hourly crypto pipeline.
 */
import type { Queue } from "bullmq";
import { config } from "../config.js";
import { getDefaultJobOptions } from "../queue/queues.js";
import { logInfo } from "../lib/logger.js";

/** Minute 0 every hour (cron). */
export const HOURLY_CRON_PATTERN = "0 * * * *";

export const HOURLY_JOB_NAME = "hourly";

/** Stable id so repeat config does not duplicate across restarts. */
export const HOURLY_REPEAT_JOB_ID = "repeat-hourly-crypto-on-the-hour";

export async function registerHourlyRepeatableJob(queue: Queue): Promise<void> {
  const defaults = getDefaultJobOptions();
  await queue.add(
    HOURLY_JOB_NAME,
    {},
    {
      ...defaults,
      repeat: { pattern: HOURLY_CRON_PATTERN, tz: config.pipelineCronTz },
      jobId: HOURLY_REPEAT_JOB_ID,
    }
  );
  logInfo("scheduler", "registered repeatable hourly job", {
    pattern: HOURLY_CRON_PATTERN,
    tz: config.pipelineCronTz,
  });
}
