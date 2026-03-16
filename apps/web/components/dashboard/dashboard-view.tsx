"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Layout } from "react-grid-layout";
import {
  getDashboardLayout,
  saveDashboardLayout,
  resetDashboardLayout,
  getDashboardTemplates,
  type LayoutItem as LayoutItemType,
} from "@/lib/dashboard-api";
import { Button } from "@/components/ui/button";
import { DashboardGrid } from "./dashboard-grid";
import { AddWidgetPanel } from "./add-widget-panel";
import { Plus, RotateCcw } from "lucide-react";

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

export function DashboardView() {
  const [layout, setLayout] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [templates, setTemplates] = useState<string[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadLayout = useCallback(() => {
    return getDashboardLayout()
      .then((data) => {
        if (data.layout?.length) setLayout(layoutToGrid(data.layout));
        else setLayout([]);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load layout");
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    getDashboardTemplates()
      .then((data) => {
        if (!cancelled) setTemplates(data.templates ?? []);
      })
      .catch(() => {});
    loadLayout().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [loadLayout]);

  const persistLayout = useCallback((next: Layout[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveDashboardLayout(gridToLayout(next)).catch(() => {});
      saveTimeoutRef.current = null;
    }, 500);
  }, []);

  const onLayoutChange = useCallback(
    (next: Layout[]) => {
      setLayout(next);
      persistLayout(next);
    },
    [persistLayout],
  );

  const handleReset = useCallback(() => {
    resetDashboardLayout()
      .then((data) => setLayout(layoutToGrid(data.layout)))
      .catch(() => {});
  }, []);

  const handleTemplate = useCallback((template: string) => {
    resetDashboardLayout(template)
      .then((data) => setLayout(layoutToGrid(data.layout)))
      .catch(() => {});
  }, []);

  const handleAddWidget = useCallback(
    (widgetType: string, defaultPosition: LayoutItemType | null) => {
      const maxY = layout.reduce((acc, item) => Math.max(acc, item.y + item.h), 0);
      const newItem: Layout[] = [
        {
          i: widgetType,
          x: defaultPosition?.x ?? 0,
          y: defaultPosition?.y ?? maxY,
          w: defaultPosition?.w ?? 4,
          h: defaultPosition?.h ?? 2,
          minW: 2,
          minH: 1,
        },
      ];
      const next = [...layout, ...newItem];
      setLayout(next);
      saveDashboardLayout(gridToLayout(next)).catch(() => {});
    },
    [layout],
  );

  const currentIds = layout.map((item) => item.i);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          className="text-sm"
          onClick={() => setShowAddPanel((v) => !v)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add widget
        </Button>
        <Button variant="outline" className="text-sm" onClick={handleReset}>
          <RotateCcw className="mr-1 h-4 w-4" />
          Reset layout
        </Button>
        {templates.length > 0 ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">Template:</span>
            {templates.map((t) => (
              <Button
                key={t}
                variant="ghost"
                className="text-xs capitalize"
                onClick={() => handleTemplate(t)}
              >
                {t.replace(/_/g, " ")}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {showAddPanel ? (
        <AddWidgetPanel
          currentLayoutIds={currentIds}
          onAdd={handleAddWidget}
          onClose={() => setShowAddPanel(false)}
        />
      ) : null}

      {layout.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--b70-border)] p-8 text-center text-slate-500">
          No widgets. Click &quot;Add widget&quot; to build your dashboard.
        </div>
      ) : (
        <DashboardGrid layout={layout} onLayoutChange={onLayoutChange} />
      )}
    </div>
  );
}
