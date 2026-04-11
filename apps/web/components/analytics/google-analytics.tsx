"use client";

import Script from "next/script";
import { Suspense, useEffect, useState } from "react";
import {
  COOKIE_CONSENT_ACCEPT_EVENT,
  hasAnalyticsConsent,
} from "@/lib/analytics/consent";
import { GaPageView } from "@/components/analytics/ga-page-view";

/**
 * Loads GA4 only after cookie consent (deferred load). Single gtag config — no duplicate tags.
 */
export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const sync = () => setConsented(hasAnalyticsConsent());
    sync();
    window.addEventListener(COOKIE_CONSENT_ACCEPT_EVENT, sync);
    return () => window.removeEventListener(COOKIE_CONSENT_ACCEPT_EVENT, sync);
  }, []);

  if (!measurementId || !consented) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-inline-init" strategy="afterInteractive">
        {`
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());
gtag('config','${measurementId}',{send_page_view:false});
`}
      </Script>
      <Suspense fallback={null}>
        <GaPageView measurementId={measurementId} />
      </Suspense>
    </>
  );
}
