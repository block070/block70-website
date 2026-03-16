"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STORAGE_KEY = "block70-cookie-consent";

export function CookieConsentBanner() {
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    setAccepted(stored === "accepted");
  }, []);

  function accept() {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, "accepted");
    setAccepted(true);
  }

  if (accepted !== false) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-700 bg-slate-900 px-4 py-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-300">
          We use cookies for authentication, analytics, and preferences. By
          continuing, you accept our use of cookies. See our{" "}
          <Link href="/legal/cookie-policy" className="underline hover:text-slate-100">
            Cookie Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={accept}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
