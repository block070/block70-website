// Per-user daily search cap for Upland free-tier users.
//
// Keys: upland:usage:<scope>:<yyyy-mm-dd>
//   scope = "u<user_id>" for authenticated users, "ip<hashed-ip>" for anon.
//
// Implementation reuses the same Redis client discovery as ./cache.ts so we
// never hold two TCP pools to Redis. In dev / environments without REDIS_URL
// we fall back to an in-memory counter, which is fine for single-process
// Next.js dev servers but will undercount behind load balancers; production
// deploys MUST set REDIS_URL.

import "server-only";
import { createHash } from "node:crypto";
import { uplandLimits, type UplandTier } from "./entitlements";

type Incrementer = {
  incr(key: string, ttlSeconds: number): Promise<number>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redisClient: any = null;
function getRedis(): Incrementer {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL;
  if (url && url.trim().length > 0) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const IORedis = require("ioredis");
      const client = new IORedis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
      redisClient = {
        async incr(key: string, ttlSeconds: number): Promise<number> {
          const n = await client.incr(key);
          if (n === 1) {
            // EXPIRE only on the first write to reset the window at midnight UTC.
            await client.expire(key, ttlSeconds);
          }
          return Number(n);
        },
      };
      return redisClient;
    } catch {
      // fall through to memory
    }
  }
  const memCounter = new Map<string, { count: number; expiresAt: number }>();
  redisClient = {
    async incr(key: string, ttlSeconds: number): Promise<number> {
      const now = Date.now();
      const hit = memCounter.get(key);
      if (!hit || hit.expiresAt < now) {
        memCounter.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 });
        return 1;
      }
      hit.count += 1;
      return hit.count;
    },
  };
  return redisClient;
}

function dayStampUTC(now = new Date()): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

function secondsUntilEndOfUtcDay(now = new Date()): number {
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
  );
  return Math.max(60, Math.floor((end - now.getTime()) / 1000));
}

export type RateLimitOutcome = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: string; // ISO midnight UTC
  scope: string;
};

export async function checkUplandSearchRateLimit(args: {
  tier: UplandTier;
  userId: number | null;
  ip?: string | null;
}): Promise<RateLimitOutcome> {
  const limits = uplandLimits(args.tier);
  const limit =
    args.userId == null
      ? // Anonymous requests only get the anon cap (falls back to dailySearchCap).
        limits.anonDailySearchCap ?? limits.dailySearchCap
      : limits.dailySearchCap;

  const scope =
    args.userId != null
      ? `u${args.userId}`
      : `ip${hashIp(args.ip ?? "unknown")}`;

  const key = `upland:usage:${scope}:${dayStampUTC()}`;
  const ttl = secondsUntilEndOfUtcDay();
  const count = await getRedis().incr(key, ttl);

  const resetAt = new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate() + 1,
  )).toISOString();

  return {
    allowed: limit === 0 ? true : count <= limit,
    count,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    scope,
  };
}

function hashIp(ip: string): string {
  return createHash("sha1").update(ip).digest("hex").slice(0, 16);
}
