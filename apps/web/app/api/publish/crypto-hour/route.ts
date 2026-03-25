import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getCryptoHourPool } from "@/lib/server/crypto-hour-pool";

export const runtime = "nodejs";

type IncomingBody = {
  topicId?: string;
  slug?: string;
  title?: string;
  format?: string;
  body?: string;
  source?: string;
  idempotencyKey?: string;
};

function timingSafeEqualString(secret: string, expected: string): boolean {
  const a = Buffer.from(secret, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Avoid Next/webpack inlining a build-time value; read at runtime from host env. */
function runtimeProcessEnv(parts: string[]): string | undefined {
  const key = parts.join("_");
  return process.env[key];
}

function normalizeSecret(raw: string): string {
  let s = raw.trim();
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s.replace(/\r/g, "");
}

function expectedPublishSecret(): string {
  const v = runtimeProcessEnv(["WEBSITE", "PUBLISH", "SECRET"]);
  return typeof v === "string" ? normalizeSecret(v) : "";
}

function secretFromRequest(request: Request): string {
  const fromHeader = request.headers.get("x-publish-secret");
  if (fromHeader) return normalizeSecret(fromHeader);
  const auth = request.headers.get("authorization");
  if (!auth) return "";
  const m = /^Bearer\s+(\S+)/i.exec(auth.trim());
  return m?.[1] ? normalizeSecret(m[1]) : "";
}

function metaFromBody(markdown: string): { description: string | null; rest: string } {
  const trimmed = markdown.trimStart();
  if (trimmed.toUpperCase().startsWith("META:")) {
    const nl = trimmed.indexOf("\n");
    const metaLine = nl === -1 ? trimmed : trimmed.slice(0, nl);
    const rest = nl === -1 ? "" : trimmed.slice(nl + 1).trimStart();
    return {
      description: metaLine.replace(/^META:\s*/i, "").trim() || null,
      rest: rest || trimmed,
    };
  }
  return { description: null, rest: markdown };
}

export async function POST(request: Request) {
  const secret = expectedPublishSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "WEBSITE_PUBLISH_SECRET is not configured on the web app" },
      { status: 503 },
    );
  }

  const provided = secretFromRequest(request);
  if (!provided || !timingSafeEqualString(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const pool = getCryptoHourPool();
  if (!pool) {
    return NextResponse.json(
      { error: "CRYPTO_HOUR_DATABASE_URL or DATABASE_URL not set" },
      { status: 503 },
    );
  }

  let json: IncomingBody;
  try {
    json = (await request.json()) as IncomingBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const topicId = typeof json.topicId === "string" ? json.topicId.trim() : "";
  const title = typeof json.title === "string" ? json.title.trim() : "";
  const body = typeof json.body === "string" ? json.body : "";
  const topicSlug =
    typeof json.slug === "string" && json.slug.trim() ? json.slug.trim() : topicId;
  const source = typeof json.source === "string" ? json.source.trim() : "crypto-on-the-hour";

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(topicId) || !title || !body) {
    return NextResponse.json({ error: "topicId, title, body required" }, { status: 400 });
  }

  const headerIdem = request.headers.get("idempotency-key")?.trim();
  const idempotencyKey =
    headerIdem ||
    (typeof json.idempotencyKey === "string" && json.idempotencyKey.trim()
      ? json.idempotencyKey.trim()
      : `crypto-hour-${topicId}-${createHash("sha256").update(body, "utf8").digest("hex").slice(0, 32)}`);

  const contentHash = createHash("sha256").update(body, "utf8").digest("hex");
  const { description, rest } = metaFromBody(body);
  const meta = {
    format: json.format ?? "markdown",
    metaDescription: description,
    displayBody: rest,
    contentHash,
  };

  try {
    await pool.query(
      `INSERT INTO web_published_articles
        (topic_id, topic_slug, source, title, body_markdown, meta, idempotency_key, content_hash)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       ON CONFLICT (source, topic_id) DO UPDATE SET
         topic_slug = EXCLUDED.topic_slug,
         title = EXCLUDED.title,
         body_markdown = EXCLUDED.body_markdown,
         meta = EXCLUDED.meta,
         idempotency_key = EXCLUDED.idempotency_key,
         content_hash = EXCLUDED.content_hash,
         updated_at = now()`,
      [topicId, topicSlug, source, title, body, JSON.stringify(meta), idempotencyKey, contentHash]
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("unique") && msg.includes("idempotency")) {
      return NextResponse.json(
        { error: "idempotency key conflict", detail: msg },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "database error", detail: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, topicId, path: `/crypto-hour/${topicId}` });
}
