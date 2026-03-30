"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  API_DOC_CATEGORY_ORDER,
  API_DOC_ENDPOINTS,
  type ApiDocEndpoint,
} from "@/lib/apidocs/catalog";
import {
  defaultPathParams,
  defaultQueryParams,
  KEY_PLACEHOLDER,
  snippetCurl,
  snippetJavaScript,
  snippetPython,
  type SnippetLang,
} from "@/lib/apidocs/snippets";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Book, ChevronRight, Copy, KeyRound, Play, Check } from "lucide-react";

const LS_KEY = "block70_apidocs_try_key";

function usePublicApiBase(): string {
  const [base, setBase] = useState("");
  useEffect(() => {
    setBase((process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, ""));
  }, []);
  return base || "https://api.example.com";
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="relative rounded-lg border border-slate-800 bg-slate-950/90">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          aria-label="Copy"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="max-h-80 overflow-auto p-3 text-[11px] leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function JsonPreview({ value, title }: { value: unknown; title: string }) {
  const text = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="max-h-96 overflow-auto p-3 text-[11px] leading-relaxed text-emerald-100/90">
        <code>{text}</code>
      </pre>
    </div>
  );
}

function EndpointCard({ ep, apiBase }: { ep: ApiDocEndpoint; apiBase: string }) {
  const [lang, setLang] = useState<SnippetLang>("curl");
  const [pathParams, setPathParams] = useState(() => defaultPathParams(ep));
  const [queryParams, setQueryParams] = useState(() => defaultQueryParams(ep));
  const [tryOpen, setTryOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [tryLoading, setTryLoading] = useState(false);
  const [tryResult, setTryResult] = useState<unknown>(null);
  const [tryStatus, setTryStatus] = useState<number | null>(null);

  useEffect(() => {
    try {
      const k = localStorage.getItem(LS_KEY);
      if (k) setApiKey(k);
    } catch {
      // ignore
    }
  }, [ep.id]);

  const persistKey = useCallback((k: string) => {
    setApiKey(k);
    try {
      if (k.trim()) localStorage.setItem(LS_KEY, k.trim());
      else localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
  }, []);

  const snippet = useMemo(() => {
    const b = apiBase || "https://YOUR_API_HOST";
    if (lang === "curl") return snippetCurl(b, ep, pathParams, queryParams);
    if (lang === "javascript") return snippetJavaScript(b, ep, pathParams, queryParams);
    return snippetPython(b, ep, pathParams, queryParams);
  }, [apiBase, ep, lang, pathParams, queryParams]);

  const runTry = async () => {
    setTryLoading(true);
    setTryResult(null);
    setTryStatus(null);
    try {
      const res = await fetch("/api/apidocs/try", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpointId: ep.id,
          apiKey: apiKey.trim(),
          pathParams,
          query: queryParams,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        status?: number;
        data?: unknown;
        error?: string;
      };
      setTryStatus(data.status ?? res.status);
      if (!res.ok) {
        setTryResult({ error: data.error ?? "Request failed" });
        return;
      }
      setTryResult(data);
    } catch (e) {
      setTryResult({ error: e instanceof Error ? e.message : "Network error" });
      setTryStatus(0);
    } finally {
      setTryLoading(false);
    }
  };

  return (
    <article
      id={`reference-${ep.id}`}
      className="scroll-mt-24 rounded-xl border border-slate-800/80 bg-slate-900/20"
    >
      <div className="border-b border-slate-800/80 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
            GET
          </span>
          <code className="text-sm text-slate-200">
            {ep.path}
          </code>
          {ep.requiresTradingScope && (
            <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200/90">
              Trading scope
            </span>
          )}
        </div>
        <h2 className="mt-3 text-lg font-semibold tracking-tight text-slate-50">{ep.title}</h2>
        <p className="mt-1 text-sm text-slate-400">{ep.description}</p>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <div className="space-y-4">
          {(ep.pathParams?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Path parameters
              </p>
              <div className="space-y-2">
                {ep.pathParams!.map((p) => (
                  <div key={p.name} className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400">
                      <code className="text-cyan-300/90">{p.name}</code> — {p.description}
                    </label>
                    <input
                      className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100"
                      value={pathParams[p.name] ?? ""}
                      onChange={(e) =>
                        setPathParams((s) => ({ ...s, [p.name]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {(ep.queryParams?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Query parameters
              </p>
              <div className="space-y-2">
                {ep.queryParams!.map((q) => (
                  <div key={q.name} className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400">
                      <code className="text-cyan-300/90">{q.name}</code> — {q.description}
                      {q.default !== undefined && (
                        <span className="text-slate-600"> (default: {String(q.default)})</span>
                      )}
                    </label>
                    <input
                      className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100"
                      value={queryParams[q.name] ?? ""}
                      onChange={(e) =>
                        setQueryParams((s) => ({ ...s, [q.name]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <JsonPreview value={ep.sampleResponse} title="Example response" />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-950/50 p-1">
            {(
              [
                ["curl", "cURL"],
                ["javascript", "JavaScript"],
                ["python", "Python"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLang(id)}
                className={
                  lang === id
                    ? "rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white"
                    : "rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-300"
                }
              >
                {label}
              </button>
            ))}
          </div>
          <CodeBlock
            code={snippet}
            label={lang === "curl" ? "Terminal" : lang === "javascript" ? "Fetch" : "requests"}
          />
          <p className="text-[11px] text-slate-500">
            Replace <code className="text-slate-400">{KEY_PLACEHOLDER}</code> with a key from{" "}
            <Link href="/developers" className="text-blue-400 hover:text-blue-300">
              API keys
            </Link>
            . Base URL in snippets uses{" "}
            <code className="text-slate-400">NEXT_PUBLIC_API_BASE_URL</code> when set.
          </p>

          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-3">
            <button
              type="button"
              onClick={() => setTryOpen(!tryOpen)}
              className="flex w-full items-center justify-between text-left text-sm font-medium text-slate-200"
            >
              <span className="flex items-center gap-2">
                <Play className="h-4 w-4 text-emerald-400" />
                Try this request
              </span>
              <ChevronRight
                className={`h-4 w-4 text-slate-500 transition-transform ${tryOpen ? "rotate-90" : ""}`}
              />
            </button>
            {tryOpen && (
              <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
                <p className="text-[11px] leading-relaxed text-amber-200/80">
                  Runs from Block70 servers toward your API host. Keys are not stored—optional
                  browser-only cache in localStorage on this device.
                </p>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    API key
                  </label>
                  <input
                    type="password"
                    autoComplete="off"
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 font-mono text-xs text-slate-100"
                    placeholder="bk70_…"
                    value={apiKey}
                    onChange={(e) => persistKey(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full border border-emerald-600/40 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/40"
                  disabled={tryLoading || !apiKey.trim().startsWith("bk70_")}
                  onClick={runTry}
                >
                  {tryLoading ? "Sending…" : "Send request"}
                </Button>
                {tryResult != null && (
                  <div className="space-y-2">
                    {tryStatus != null && (
                      <p className="text-xs text-slate-400">
                        HTTP <span className="tabular-nums text-slate-200">{tryStatus}</span>
                      </p>
                    )}
                    <JsonPreview value={tryResult} title="Response" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function ApiDocsView() {
  const apiBase = usePublicApiBase();

  const byCategory = useMemo(() => {
    const m = new Map<string, ApiDocEndpoint[]>();
    for (const c of API_DOC_CATEGORY_ORDER) {
      m.set(c.id, []);
    }
    for (const ep of API_DOC_ENDPOINTS) {
      m.get(ep.category)?.push(ep);
    }
    return m;
  }, []);

  return (
    <div className="min-h-screen bg-[var(--b70-bg,#0a0c10)]">
      <div className="mx-auto flex max-w-[1400px] gap-10 px-4 pb-20 pt-8 lg:px-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-8 space-y-8">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Reference
              </p>
              <nav className="mt-3 space-y-6 text-sm">
                {API_DOC_CATEGORY_ORDER.map((cat) => {
                  const eps = byCategory.get(cat.id) ?? [];
                  if (eps.length === 0) return null;
                  return (
                    <div key={cat.id}>
                      <p className="mb-2 font-medium text-slate-300">{cat.label}</p>
                      <ul className="space-y-1 border-l border-slate-800 pl-3">
                        {eps.map((ep) => (
                          <li key={ep.id}>
                            <a
                              href={`#reference-${ep.id}`}
                              className="block py-0.5 text-xs text-slate-500 hover:text-blue-400"
                            >
                              {ep.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </nav>
            </div>
            <Link href="/developers">
              <Button variant="outline" className="w-full justify-center gap-2 text-xs">
                <KeyRound className="h-3.5 w-3.5" />
                API keys
              </Button>
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-10 border-b border-slate-800/80 pb-8">
            <div className="mb-4 lg:hidden">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Jump to section
              </label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-200"
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) document.getElementById(v)?.scrollIntoView({ behavior: "smooth" });
                  e.target.value = "";
                }}
              >
                <option value="">—</option>
                {API_DOC_CATEGORY_ORDER.map((cat) => {
                  const eps = byCategory.get(cat.id) ?? [];
                  if (eps.length === 0) return null;
                  return (
                    <optgroup key={cat.id} label={cat.label}>
                      {eps.map((ep) => (
                        <option key={ep.id} value={`reference-${ep.id}`}>
                          {ep.title}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <Book className="h-3.5 w-3.5" />
              <span>Developer API</span>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span className="text-slate-400">REST reference</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
              Block70 API
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
              Integrate signals, market data, opportunities, and portfolio insights. All routes
              below are under{" "}
              <code className="rounded bg-slate-900 px-1.5 py-0.5 text-[12px] text-cyan-200/90">
                /api/v1/dev
              </code>{" "}
              and require an API key per request.
            </p>
          </header>

          <Card className="mb-10 border-slate-800 bg-slate-900/30">
            <CardHeader title="Authentication" subtitle="Every request" />
            <div className="space-y-4 px-5 pb-5 text-sm text-slate-300">
              <p>
                Send your secret key in the <code className="text-cyan-200/80">X-API-Key</code>{" "}
                header. Keys are created in the developer dashboard; rate limits apply by plan.
              </p>
              <CodeBlock
                label="Header"
                code={`X-API-Key: bk70_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}
              />
              <div className="grid gap-3 sm:grid-cols-3 text-xs">
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <p className="font-medium text-rose-300">401</p>
                  <p className="mt-1 text-slate-500">Missing or invalid key</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <p className="font-medium text-amber-300">403</p>
                  <p className="mt-1 text-slate-500">Wrong scopes or IP not allowed</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <p className="font-medium text-orange-300">429</p>
                  <p className="mt-1 text-slate-500">Daily rate limit exceeded</p>
                </div>
              </div>
            </div>
          </Card>

          {API_DOC_CATEGORY_ORDER.map((cat) => {
            const eps = byCategory.get(cat.id) ?? [];
            if (eps.length === 0) return null;
            return (
              <section key={cat.id} id={`category-${cat.id}`} className="mb-14 scroll-mt-20">
                <h2 className="mb-6 flex items-center gap-2 border-b border-slate-800 pb-3 text-xl font-semibold text-slate-100">
                  {cat.label}
                  <span className="text-sm font-normal text-slate-500">({eps.length})</span>
                </h2>
                <div className="space-y-8">
                  {eps.map((ep) => (
                    <EndpointCard key={ep.id} ep={ep} apiBase={apiBase} />
                  ))}
                </div>
              </section>
            );
          })}
        </main>
      </div>
    </div>
  );
}
