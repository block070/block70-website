import type { ReactNode } from "react";

export const metadata = {
  title: "System status · Block70",
  description:
    "Live health for Block70 API, signals pipeline, and AI services. Uptime history and incident reports.",
};

export default function ServiceStatusLayout({ children }: { children: ReactNode }) {
  return children;
}
