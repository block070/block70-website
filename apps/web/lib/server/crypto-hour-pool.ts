import { Pool } from "pg";

/**
 * Same Postgres as `apps/crypto-on-the-hour` (table `web_published_articles`).
 * Set on Vercel / hosting: CRYPTO_HOUR_DATABASE_URL or DATABASE_URL.
 */
declare global {
  // eslint-disable-next-line no-var
  var __cryptoHourPgPool: Pool | undefined;
}

function runtimeEnv(parts: string[]): string {
  const key = parts.join("_");
  const v = process.env[key];
  return typeof v === "string" ? v.trim().replace(/\r/g, "") : "";
}

export function getCryptoHourPool(): Pool | null {
  const connectionString =
    runtimeEnv(["CRYPTO", "HOUR", "DATABASE", "URL"]) || runtimeEnv(["DATABASE", "URL"]) || "";
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
