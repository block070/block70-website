/**
 * Lightweight structured logging for workers and pipeline.
 */

export type LogFields = Record<string, unknown>;

function format(component: string, msg: string, fields?: LogFields): string {
  const ts = new Date().toISOString();
  const extra = fields && Object.keys(fields).length ? ` ${JSON.stringify(fields)}` : "";
  return `[${ts}] [${component}] ${msg}${extra}`;
}

export function logInfo(component: string, msg: string, fields?: LogFields): void {
  console.log(format(component, msg, fields));
}

export function logWarn(component: string, msg: string, fields?: LogFields): void {
  console.warn(format(component, msg, fields));
}

export function logError(component: string, msg: string, fields?: LogFields): void {
  console.error(format(component, msg, fields));
}
