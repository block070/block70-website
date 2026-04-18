// Minimal structured logger for the ingestion path. Writes JSON lines to
// stdout so the n8n HTTP Request node (or the block70-error-logger) can tail
// the container. We deliberately avoid Winston/Pino here -- each ingestion
// run is short-lived and the observability requirements are modest.

export type IngestionEvent = {
  at: string;
  level: "info" | "warn" | "error";
  runId?: string;
  source?: string;
  msg: string;
  extra?: Record<string, unknown>;
};

function emit(level: IngestionEvent["level"], msg: string, fields: Record<string, unknown> = {}) {
  const payload: IngestionEvent = {
    at: new Date().toISOString(),
    level,
    msg,
    ...fields,
    extra: fields.extra as Record<string, unknown> | undefined,
  };
  // eslint-disable-next-line no-console -- intentional structured stdout
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const ingestionLogger = {
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields ?? {}),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields ?? {}),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields ?? {}),
};
