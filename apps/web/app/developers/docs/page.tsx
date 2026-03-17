"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

const BASE =
  (typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
    : "") + "/api/v1/dev";

export default function DevelopersDocsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/developers">
          <Button variant="outline">← Dashboard</Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-50">Developer API</h1>
      </div>

      <Card>
        <CardHeader title="Authentication" />
        <div className="space-y-2 p-4 text-sm text-slate-300">
          <p>Include your API key in every request:</p>
          <pre className="overflow-x-auto rounded bg-slate-900 p-3 font-mono text-xs">
            {`X-API-Key: bk70_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}
          </pre>
          <p className="text-slate-500">
            Rate limits apply by plan (Free: 100/day, Pro: 10,000/day,
            Enterprise: unlimited). Endpoints below are for the{" "}
            <code className="rounded bg-slate-900 px-1 py-0.5 text-[11px]">
              /api/v1/dev
            </code>{" "}
            developer API surface.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Signals" />
        <div className="space-y-4 p-4 text-sm">
          <div>
            <p className="font-medium text-slate-200">GET /signals</p>
            <p className="text-slate-500">List signals. Query: chain, signal_type, token, limit, offset.</p>
            <pre className="mt-1 rounded bg-slate-900 p-2 font-mono text-xs">{`curl -H "X-API-Key: YOUR_KEY" "${BASE}/signals?limit=10"`}</pre>
          </div>
          <div>
            <p className="font-medium text-slate-200">GET /signals/latest</p>
            <p className="text-slate-500">Latest signals. Query: limit.</p>
          </div>
          <div>
            <p className="font-medium text-slate-200">GET /signals/{`{token}`}</p>
            <p className="text-slate-500">Signals for a token symbol or address.</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Wallets" />
        <div className="space-y-4 p-4 text-sm">
          <p className="font-medium text-slate-200">GET /wallets</p>
          <p className="text-slate-500">Smart wallet leaderboard.</p>
          <p className="font-medium text-slate-200">GET /wallets/{`{address}`}</p>
          <p className="text-slate-500">Single wallet profile.</p>
          <p className="font-medium text-slate-200">GET /wallets/{`{address}`}/transactions</p>
          <p className="text-slate-500">Wallet-related opportunities/activity.</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Opportunities" />
        <div className="space-y-2 p-4 text-sm">
          <p className="font-medium text-slate-200">GET /opportunities</p>
          <p className="text-slate-500">List opportunities. Query: type, chain, limit. Returns type, alpha score, estimated ROI, confidence.</p>
          <p className="font-medium text-slate-200">GET /opportunities/{`{id}`}</p>
          <p className="text-slate-500">Single opportunity by ID.</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Market" />
        <div className="space-y-2 p-4 text-sm">
          <p className="font-medium text-slate-200">GET /market/prices</p>
          <p className="font-medium text-slate-200">GET /market/trending</p>
          <p className="font-medium text-slate-200">GET /market/gainers</p>
          <p className="font-medium text-slate-200">GET /market/losers</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Airdrops" />
        <div className="space-y-2 p-4 text-sm">
          <p className="font-medium text-slate-200">GET /airdrops</p>
          <p className="font-medium text-slate-200">GET /airdrops/upcoming</p>
          <p className="font-medium text-slate-200">GET /airdrops/active</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Strategies" />
        <div className="space-y-2 p-4 text-sm">
          <p className="font-medium text-slate-200">GET /strategies</p>
          <p className="text-slate-500">Current user’s strategies.</p>
          <p className="font-medium text-slate-200">GET /strategies/{`{id}`}</p>
          <p className="font-medium text-slate-200">GET /strategies/backtests</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Portfolio" />
        <div className="space-y-2 p-4 text-sm">
          <p className="font-medium text-slate-200">GET /portfolio</p>
          <p className="font-medium text-slate-200">GET /portfolio/tokens</p>
          <p className="font-medium text-slate-200">GET /portfolio/performance</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Response format" />
        <div className="p-4 text-sm text-slate-400">
          All endpoints return JSON. 401 = invalid/missing API key. 429 = rate limit exceeded (see X-RateLimit-* headers).
        </div>
      </Card>
    </div>
  );
}
