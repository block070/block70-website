/** URL/compare slug from DeFiLlama chain display name (lowercase, hyphenated). */
export function chainsCompareSlug(chainName: string): string {
  return chainName
    .trim()
    .toLowerCase()
    .replace(/mainnet/gi, "")
    .replace(/\bone\b/gi, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
