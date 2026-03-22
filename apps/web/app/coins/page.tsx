import { Suspense } from "react";
import { CoinsPageClient } from "./coins-page-client";
import { CoinsLoading } from "./loading";

export const metadata = {
  title: "Coins · Block70 Crypto Data",
  description:
    "Market data for majors, aligned with the Block70 intelligence system.",
};

export default function CoinsPage() {
  return (
    <Suspense fallback={<CoinsLoading />}>
      <CoinsPageClient />
    </Suspense>
  );
}
