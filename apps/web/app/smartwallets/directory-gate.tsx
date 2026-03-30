"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { WhaleDirectoryRow } from "@/lib/smartwallets-server";
import { WhaleDirectoryTable } from "@/components/smartwallets/whale-directory-table";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/plan-tier";

export function WhaleDirectoryGate({ rows }: { rows: WhaleDirectoryRow[] }) {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((u) => setShowHint(!hasFeature(u.plan_type, "opportunities_full")))
      .catch(() => setShowHint(true));
  }, []);

  return (
    <div className="space-y-4">
      {showHint ? (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <span className="font-medium text-amber-50">Limited directory depth.</span> Your API response
          is capped on Free/Pro.{" "}
          <Link href="/pricing" className="font-medium underline underline-offset-2 hover:text-white">
            Elite or Quant
          </Link>{" "}
          unlocks the full smart-money leaderboard and metrics.
        </div>
      ) : null}
      <WhaleDirectoryTable rows={rows} />
    </div>
  );
}
