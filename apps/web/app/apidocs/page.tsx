import type { Metadata } from "next";
import { ApiDocsView } from "@/components/apidocs/api-docs-view";

export const metadata: Metadata = {
  title: "API reference · Block70",
  description:
    "Block70 developer API: signals, wallets, opportunities, market data, airdrops, strategies, and portfolio. REST reference with live try-it.",
};

export default function ApiDocsPage() {
  return <ApiDocsView />;
}
