import { clsx } from "clsx";
import type { CSSProperties } from "react";

type SkeletonProps = {
  className?: string;
  style?: CSSProperties;
};

export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-b70-sm bg-[var(--b70-border)]",
        className,
      )}
      style={style}
      aria-hidden
    />
  );
}

export function CoinTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-b70-md border border-[var(--b70-border)] bg-[var(--b70-card)]">
      <div className="flex border-b border-[var(--b70-border)] px-4 py-3 gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="divide-y divide-[var(--b70-border)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SignalsFeedSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-b70-md border border-[var(--b70-border)] bg-[var(--b70-card)] p-4"
        >
          <div className="flex justify-between gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-1 h-3 w-3/4" />
          <div className="mt-2 flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-b70-md border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
      <Skeleton className="h-4 w-32 mb-3" />
      <div className="flex items-end gap-0.5 h-40">
        {Array.from({ length: 40 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{
              height: `${30 + Math.sin(i * 0.3) * 40}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
