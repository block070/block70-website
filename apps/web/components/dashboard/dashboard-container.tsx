"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { Layout } from "react-grid-layout";
import {
  getDashboardLayout,
  saveDashboardLayout,
  type LayoutItem as LayoutItemType,
} from "@/lib/dashboard-api";
import { DashboardGrid } from "./dashboard-grid";
import { WidgetLoader } from "./widget-loader";

function layoutToGrid(layout: LayoutItemType[]): Layout[] {
  return layout.map((item) => ({
    i: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: 2,
    minH: 1,
  }));
}

function gridToLayout(layout: Layout[]): LayoutItemType[] {
  return layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
}

export function DashboardContainer() {
  const [layout, setLayout] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistLayout = useCallback((next: Layout[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveDashboardLayout(gridToLayout(next)).catch(() => {
        // silent fail; user can reset
      });
      saveTimeoutRef.current = null;
    }, 500);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getDashboardLayout()
      .then((data) => {
        if (!cancelled && data.layout?.length) {
          setLayout(layoutToGrid(data.layout));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load layout");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const onLayoutChange = useCallback(
    (next: Layout[]) => {
      setLayout(next);
      persistLayout(next);
    },
    [persistLayout],
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-8 text-center text-slate-400">
        Loading dashboard…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-100">
        {error}. Log in to use the customizable dashboard.
      </div>
    );
  }

  if (layout.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--b70-border)] p-8 text-center text-slate-500">
        No widgets. Add widgets from the panel to build your dashboard.
      </div>
    );
  }

  return <DashboardGrid layout={layout} onLayoutChange={onLayoutChange} />;
}
