"use client";

import { lazy, Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type WidgetSettings = {
  chain?: string;
  signal_type?: string;
  token?: string;
  limit?: number;
  [key: string]: string | number | undefined;
};

const SignalsWidget = lazy(() =>
  import("@/components/widgets/signals-widget").then((m) => ({ default: m.SignalsWidget })),
);
const WhaleWidget = lazy(() =>
  import("@/components/widgets/whale-widget").then((m) => ({ default: m.WhaleWidget })),
);
const OpportunitiesWidget = lazy(() =>
  import("@/components/widgets/opportunities-widget").then((m) => ({ default: m.OpportunitiesWidget })),
);
const TrendingCoinsWidget = lazy(() =>
  import("@/components/widgets/trending-coins-widget").then((m) => ({ default: m.TrendingCoinsWidget })),
);
const MarketOverviewWidget = lazy(() =>
  import("@/components/widgets/market-overview-widget").then((m) => ({ default: m.MarketOverviewWidget })),
);
const AirdropWidget = lazy(() =>
  import("@/components/widgets/airdrop-widget").then((m) => ({ default: m.AirdropWidget })),
);
const WalletActivityWidget = lazy(() =>
  import("@/components/widgets/wallet-activity-widget").then((m) => ({ default: m.WalletActivityWidget })),
);

const WIDGET_MAP: Record<
  string,
  React.LazyExoticComponent<React.ComponentType<{ widgetId: string; settings?: WidgetSettings }>>
> = {
  signals: SignalsWidget,
  whale: WhaleWidget,
  opportunities: OpportunitiesWidget,
  "trending-coins": TrendingCoinsWidget,
  "market-overview": MarketOverviewWidget,
  airdrop: AirdropWidget,
  "wallet-activity": WalletActivityWidget,
};

function WidgetFallback() {
  return (
    <Card className="p-4">
      <Skeleton className="mb-2 h-5 w-32" />
      <Skeleton className="h-20 w-full" />
    </Card>
  );
}

type WidgetLoaderProps = {
  widgetId: string;
  widgetType: string;
  settings?: WidgetSettings;
};

export function WidgetLoader({ widgetId, widgetType, settings }: WidgetLoaderProps) {
  const Component = WIDGET_MAP[widgetType];
  if (!Component) {
    return (
      <Card className="p-4">
        <p className="text-sm text-slate-400">Unknown widget: {widgetType}</p>
      </Card>
    );
  }
  return (
    <Suspense fallback={<WidgetFallback />}>
      <Component widgetId={widgetId} settings={settings} />
    </Suspense>
  );
}
