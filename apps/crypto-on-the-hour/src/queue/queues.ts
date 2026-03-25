import { Queue, type DefaultJobOptions } from "bullmq";
import { createRedis } from "./redis.js";
import { config } from "../config.js";

export const QUEUE_NAME = "cryptoOnTheHour";

let _queue: Queue | null = null;

export function getDefaultJobOptions(): DefaultJobOptions {
  return {
    attempts: Math.max(1, config.workerJobAttempts),
    backoff: {
      type: "exponential",
      delay: Math.max(1000, config.workerJobBackoffMs),
    },
    removeOnComplete: 50,
    removeOnFail: 50,
  };
}

export function getQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, {
      connection: createRedis(),
      defaultJobOptions: getDefaultJobOptions(),
    });
  }
  return _queue;
}
