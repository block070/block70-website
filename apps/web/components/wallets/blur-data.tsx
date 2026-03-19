import type { ReactNode } from "react";
import { LockOverlay } from "./lock-overlay";

type BlurDataProps = {
  children: ReactNode;
  locked?: boolean;
  tooltip?: string;
};

export function BlurData({ children, locked = false, tooltip = "Unlock to view" }: BlurDataProps) {
  return (
    <div className="relative" title={locked ? tooltip : undefined}>
      <div className={locked ? "select-none blur-[3px]" : ""}>{children}</div>
      {locked ? <LockOverlay message={tooltip} /> : null}
    </div>
  );
}

