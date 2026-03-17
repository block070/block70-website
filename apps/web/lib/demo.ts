declare global {
  interface Window {
    __BLOCK70_DEMO_MODE__?: string;
  }
}

export function isDemoMode(): boolean {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  }
  return (
    window.__BLOCK70_DEMO_MODE__ === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  );
}

