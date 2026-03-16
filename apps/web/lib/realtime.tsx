"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type RealtimeContextValue = {
  lastUpdated: Date | null;
  refresh: () => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({
  children,
  pollIntervalMs = 30_000,
  onPoll,
}: {
  children: ReactNode;
  pollIntervalMs?: number;
  onPoll?: () => void | Promise<void>;
}) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    await onPoll?.();
    setLastUpdated(new Date());
  }, [onPoll]);

  useEffect(() => {
    if (pollIntervalMs <= 0 || !onPoll) return;
    const t = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(t);
  }, [pollIntervalMs, onPoll, refresh]);

  return (
    <RealtimeContext.Provider value={{ lastUpdated, refresh }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  return ctx ?? { lastUpdated: null, refresh: () => {} };
}
