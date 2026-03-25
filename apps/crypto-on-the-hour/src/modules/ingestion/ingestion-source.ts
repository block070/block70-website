/**
 * Common contract for feed ingestion (RSS today; Twitter / on-chain tomorrow).
 */
import type { RawArticle } from "../../types/domain.js";

export type IngestedItem = Pick<
  RawArticle,
  "title" | "link" | "summary" | "published_at"
>;

export interface IngestionSource {
  readonly name: string;
  fetchArticles(): Promise<IngestedItem[]>;
}
