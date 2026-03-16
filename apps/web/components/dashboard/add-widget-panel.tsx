"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardWidgets, type DashboardWidgetDto } from "@/lib/dashboard-api";
import { Plus } from "lucide-react";

type AddWidgetPanelProps = {
  currentLayoutIds: string[];
  onAdd: (widgetType: string, defaultPosition: { i: string; x: number; y: number; w: number; h: number } | null) => void;
  onClose?: () => void;
};

export function AddWidgetPanel({
  currentLayoutIds,
  onAdd,
  onClose,
}: AddWidgetPanelProps) {
  const [widgets, setWidgets] = useState<DashboardWidgetDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardWidgets()
      .then(setWidgets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const available = widgets.filter(
    (w) => !currentLayoutIds.includes(w.widget_type),
  );

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="heading-md">Add widget</h3>
        {onClose ? (
          <Button variant="ghost" className="text-sm px-2 py-1" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>
      {loading ? (
        <p className="text-xs text-slate-500">Loading widgets…</p>
      ) : available.length === 0 ? (
        <p className="text-xs text-slate-500">
          All widgets are already on your dashboard.
        </p>
      ) : (
        <ul className="space-y-2">
          {available.map((w) => (
            <li
              key={w.id}
              className="flex items-center justify-between gap-3 rounded border border-[var(--b70-border)] px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-slate-200">{w.widget_name}</p>
                {w.description ? (
                  <p className="text-xs text-slate-500">{w.description}</p>
                ) : null}
              </div>
              <Button
                className="text-sm px-2 py-1"
                onClick={() => {
                  const pos = w.default_position;
                  onAdd(w.widget_type, pos ? { ...pos, i: w.widget_type } : null);
                  onClose?.();
                }}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
