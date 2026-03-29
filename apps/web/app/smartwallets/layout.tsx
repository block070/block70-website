import type { ReactNode } from "react";

import { SmartwalletsSubnav } from "@/components/smartwallets/smartwallets-subnav";

export default function SmartwalletsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2">
      <SmartwalletsSubnav />
      {children}
    </div>
  );
}
