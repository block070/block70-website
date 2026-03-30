import type { ApiDocEndpoint } from "./catalog";
import { buildDevPath, buildQueryString } from "./catalog";

export const KEY_PLACEHOLDER = "YOUR_API_KEY";

export type SnippetLang = "curl" | "javascript" | "python";

export function defaultPathParams(ep: ApiDocEndpoint): Record<string, string> {
  const o: Record<string, string> = {};
  for (const p of ep.pathParams ?? []) {
    o[p.name] = p.example;
  }
  return o;
}

export function defaultQueryParams(ep: ApiDocEndpoint): Record<string, string> {
  const o: Record<string, string> = {};
  for (const q of ep.queryParams ?? []) {
    if (q.default !== undefined) o[q.name] = String(q.default);
    else if (q.example !== undefined) o[q.name] = String(q.example);
  }
  return o;
}

export function snippetCurl(
  baseUrl: string,
  ep: ApiDocEndpoint,
  pathParams: Record<string, string>,
  query: Record<string, string>
): string {
  const base = baseUrl.replace(/\/$/, "");
  const path = buildDevPath(ep, pathParams);
  const qs = buildQueryString(query);
  return `curl -sS \\
  -H "X-API-Key: ${KEY_PLACEHOLDER}" \\
  "${base}${path}${qs}"`;
}

export function snippetJavaScript(
  baseUrl: string,
  ep: ApiDocEndpoint,
  pathParams: Record<string, string>,
  query: Record<string, string>
): string {
  const base = baseUrl.replace(/\/$/, "");
  const path = buildDevPath(ep, pathParams);
  const qs = buildQueryString(query);
  return `const res = await fetch(\`${base}${path}${qs}\`, {
  headers: { "X-API-Key": "${KEY_PLACEHOLDER}" },
});

if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
const data = await res.json();`;
}

export function snippetPython(
  baseUrl: string,
  ep: ApiDocEndpoint,
  pathParams: Record<string, string>,
  query: Record<string, string>
): string {
  const base = baseUrl.replace(/\/$/, "");
  const path = buildDevPath(ep, pathParams);
  const filtered = Object.fromEntries(
    Object.entries(query).filter(([, v]) => v !== "" && v != null)
  );
  if (Object.keys(filtered).length === 0) {
    const qs = buildQueryString(query);
    return `import requests

url = "${base}${path}${qs}"
headers = {"X-API-Key": "${KEY_PLACEHOLDER}"}

r = requests.get(url, headers=headers, timeout=30)
r.raise_for_status()
print(r.json())`;
  }
  return `import requests

url = f"${base}${path}"
headers = {"X-API-Key": "${KEY_PLACEHOLDER}"}
params = ${JSON.stringify(filtered)}

r = requests.get(url, headers=headers, params=params, timeout=30)
r.raise_for_status()
print(r.json())`;
}
