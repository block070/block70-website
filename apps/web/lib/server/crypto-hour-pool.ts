import { Pool } from "pg";

/**
 * Same Postgres as `apps/crypto-on-the-hour` (table `web_published_articles`).
 * Set on Vercel / hosting: CRYPTO_HOUR_DATABASE_URL or DATABASE_URL.
 */
declare global {
  // eslint-disable-next-line no-var
  var __cryptoHourPgPool: Pool | undefined;
}

export function getCryptoHourPool(): Pool | null {
  const connectionString =
    process.env.CRYPTO_HOUR_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
  if (!connectionString) return null;

  if (!globalThis.__cryptoHourPgPool) {
    globalThis.__cryptoHourPgPool = new Pool({
      connectionString,
      max: 4,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8000,
    });
  }
  return globalThis.__cryptoHourPgPool;
}
