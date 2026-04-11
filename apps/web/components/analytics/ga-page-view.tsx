"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Sends SPA route changes to GA4 (App Router client navigations do not trigger a full page load).
 */
export function GaPageView({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!measurementId || typeof window === "undefined") return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40;

    const send = () => {
      if (cancelled) return;
      const g = window.gtag;
      if (typeof g !== "function") {
        if (attempts++ < maxAttempts) window.setTimeout(send, 50);
        return;
      }
      const q = searchParams?.toString();
      const page_path = pathname + (q ? `?${q}` : "");
      const page_location = `${window.location.origin}${page_path}`;
      g("event", "page_view", {
        page_path,
        page_location,
        page_title: document.title,
      });
    };

    send();
    return () => {
      cancelled = true;
    };
  }, [pathname, searchParams, measurementId]);

  return null;
}
