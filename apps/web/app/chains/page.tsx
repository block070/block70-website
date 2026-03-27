import { Suspense } from "react";
import { ChainsIntelligenceClient } from "@/components/chains/chains-intelligence-client";
import { Skeleton } from "@/components/ui/skeleton";

function ChainsFallback() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Skeleton className="h-10 w-2/3 max-w-md" />
      <Skeleton className="h-4 w-full max-w-2xl" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </div>
  );
}

export default function ChainsPage() {
  return (
    <Suspense fallback={<ChainsFallback />}>
      <ChainsIntelligenceClient />
    </Suspense>
  );
}
