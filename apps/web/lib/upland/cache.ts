// Redis-backed filter cache with a graceful in-memory fallback.
//
// Behavior:
//   * REDIS_URL set    -> use ioredis (shared singleton).
//   * REDIS_URL unset  -> fall back to a bounded in-memory LRU with the same
//     interface so `npm run dev` works without extra infra.
//
// Keys follow the plan: `upland:props:v1:<sha1(canonicalized-filters)>`.
// Invalidation uses SCAN + DEL on a single prefix so the ingestion layer can
// call `invalidateUplandCache()` at the end of every run.

import "server-only";
import { createHash } from "node:crypto";

const CACHE_KEY_PREFIX = "upland:props:v1:";
const DEFAULT_TTL_SECONDS = 30;

type CacheClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delByPrefix(prefix: string): Promise<number>;
};

// -----------------------------------------------------------------------------
// In-memory fallback (bounded, simple FIFO expiry).
// -----------------------------------------------------------------------------
class MemoryCache implements CacheClient {
  private store = new Map<string, { value: string; expiresAt: number }>();
  private readonly maxEntries = 500;

  async get(key: string): Promise<string | null> {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return hit.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.store.size >= this.maxEntries) {
      // FIFO eviction: Map preserves insertion order, so the first key is oldest.
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delByPrefix(prefix: string): Promise<number> {
    let n = 0;
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        n += 1;
      }
    }
    return n;
  }
}

// -----------------------------------------------------------------------------
// Redis implementation (lazy-loaded so the in-memory path has zero deps at rt).
// -----------------------------------------------------------------------------
class RedisCache implements CacheClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- avoid eager import of ioredis types
  private client: any;

  constructor(url: string) {
    // Lazy require so Next's bundler doesn't pull ioredis into code paths that
    // never need it (e.g. static pages).
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const IORedis = require("ioredis");
    // ioredis's default constructor handles both `redis://` and `rediss://`.
    this.client = new IORedis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
  }

  async get(key: string): Promise<string | null> {
    try {
      return (await this.client.get(key)) ?? null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, value, "EX", Math.max(1, Math.floor(ttlSeconds)));
    } catch {
      /* cache failures are non-fatal */
    }
  }

  async delByPrefix(prefix: string): Promise<number> {
    let total = 0;
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys]: [string, string[]] = await this.client.scan(
          cursor,
          "MATCH",
          `${prefix}*`,
          "COUNT",
          200,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          total += (await this.client.del(keys)) ?? 0;
        }
      } while (cursor !== "0");
    } catch {
      /* best-effort */
    }
    return total;
  }
}

// -----------------------------------------------------------------------------
// Singleton accessor.
// -----------------------------------------------------------------------------
let clientInstance: CacheClient | null = null;

function getClient(): CacheClient {
  if (clientInstance) return clientInstance;
  const url = process.env.REDIS_URL;
  if (url && url.trim().length > 0) {
    try {
      clientInstance = new RedisCache(url);
    } catch (err) {
      console.warn(
        "[upland/cache] Failed to init Redis, using in-memory fallback:",
        err,
      );
      clientInstance = new MemoryCache();
    }
  } else {
    clientInstance = new MemoryCache();
  }
  return clientInstance;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------
export function hashFilterKey(canonicalJson: string): string {
  const h = createHash("sha1").update(canonicalJson).digest("hex");
  return `${CACHE_KEY_PREFIX}${h}`;
}

export async function getCached<T>(key: string): Promise<T | null> {
  const raw = await getClient().get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  await getClient().set(key, JSON.stringify(value), ttlSeconds);
}

/**
 * Remove every cache entry under the upland filter prefix. Called at the end
 * of every ingestion run so readers see fresh data on their next request.
 */
export async function invalidateUplandCache(): Promise<number> {
  return getClient().delByPrefix(CACHE_KEY_PREFIX);
}
