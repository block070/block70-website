"use client";

import { useEffect, useRef, useState } from "react";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { Layout } from "react-grid-layout";
import { WidgetLoader } from "./widget-loader";

const COLUMNS = 12;
const ROW_HEIGHT = 80;
const COMPACT_TYPE: "vertical" | "horizontal" | null = "vertical";

type DashboardGridProps = {
  layout: Layout[];
  onLayoutChange: (layout: Layout[]) => void;
};

export function DashboardGrid({ layout, onLayoutChange }: DashboardGridProps) {
  const [width, setWidth] = useState(1200);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.offsetWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (layout.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="w-full">
      <GridLayout
        className="layout"
        layout={layout}
        onLayoutChange={onLayoutChange}
        cols={COLUMNS}
        rowHeight={ROW_HEIGHT}
        width={width}
        compactType={COMPACT_TYPE}
        isDraggable={true}
        isResizable={true}
        margin={[12, 12]}
        containerPadding={[0, 0]}
        useCSSTransforms={true}
      >
        {layout.map((item) => (
          <div key={item.i} className="min-h-0">
            <WidgetLoader widgetId={item.i} widgetType={item.i} settings={{}} />
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
