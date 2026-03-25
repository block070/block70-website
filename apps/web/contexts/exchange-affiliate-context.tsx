"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const ExchangeAffiliateContext = createContext<Record<string, string>>({});

export function ExchangeAffiliateProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/exchange-affiliate-links", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as { templates?: Record<string, string> };
        if (!cancelled) setTemplates(j.templates ?? {});
      } catch {
        /* keep {} */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => templates, [templates]);
  return (
    <ExchangeAffiliateContext.Provider value={value}>{children}</ExchangeAffiliateContext.Provider>
  );
}

export function useExchangeAffiliateTemplates(): Record<string, string> {
  return useContext(ExchangeAffiliateContext);
}
