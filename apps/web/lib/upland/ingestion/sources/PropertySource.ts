// Shared interface for every Upland ingestion source.
//
// A source is anything that yields a stream of NormalizedProperty payloads in
// pages. The orchestrator doesn't care whether that stream came from the real
// Upland API, a scraped HTML page, a CSV dump, or the in-repo mock fixture --
// it just drains the iterator, normalizes, and upserts.
//
// Adding a new source:
//   1. Export a class that implements PropertySource.
//   2. Wire it into createSource() in ../sources/index.ts (gated on env).

export type NormalizedVehicle = {
  externalId?: string | null;
  name: string | null;
  type: string;
  rarity: string | null;
  raw?: unknown;
};

export type NormalizedProperty = {
  uplandId: string;
  address: string;
  city: string;
  state: string | null;
  country: string;
  neighborhood: string | null;
  price: number | null;
  mintPrice: number | null;
  yieldPerMonth: number | null;
  forSale: boolean;
  owner: string | null;
  lat: number | null;
  lng: number | null;
  collection: string | null;

  hasStructure: boolean;
  structureType: string | null;
  vehicles: NormalizedVehicle[];

  raw?: unknown;
};

export type IngestionPage = {
  items: NormalizedProperty[];
  /** Opaque cursor the source hands itself on the next iteration. */
  cursor: string | null;
};

export interface PropertySource {
  /** Identifier logged on every ingestion_run row. */
  readonly name: string;

  /**
   * Stream successive pages of properties. Implementations should yield until
   * the underlying source is exhausted (cursor = null) OR `maxPages` hit.
   */
  pages(opts: { maxPages?: number }): AsyncIterable<IngestionPage>;
}
