type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlSeconds: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cached<T>(key: string, ttlSeconds: number, producer: () => Promise<T>) {
  const existing = getCached<T>(key);
  if (existing) return existing;
  const value = await producer();
  setCached(key, value, ttlSeconds);
  return value;
}

