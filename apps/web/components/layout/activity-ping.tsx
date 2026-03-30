"use client";

import { useEffect, useRef } from "react";
import { getToken } from "@/lib/auth";
import { pingActivity } from "@/lib/notifications-api";

/** Updates API last_seen_at for retention jobs; no-op when signed out. */
export function ActivityPing() {
  const done = useRef(false);

  useEffect(() => {
    if (!getToken() || done.current) return;
    done.current = true;
    void pingActivity().catch(() => {});
    const t = setInterval(() => {
      if (!getToken()) return;
      void pingActivity().catch(() => {});
    }, 300_000);
    return () => clearInterval(t);
  }, []);

  return null;
}
