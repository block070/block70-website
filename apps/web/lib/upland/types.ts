// Public API DTOs and shared enums for the Upland property search.
//
// These are the types the frontend and API route hand to one another. They
// are deliberately plain (no Prisma imports) so server components and the
// browser can share the same shape without pulling Prisma into the bundle.

export type VehicleDto = {
  id: string;
  name: string | null;
  type: string;
  rarity: string | null;
};

export type PropertyDto = {
  id: string;
  uplandId: string;
  address: string;
  city: string;
  state: string | null;
  country: string;
  neighborhood: string | null;

  price: number | null;
  mintPrice: number | null;
  markupPercentage: number | null;
  yieldPerMonth: number | null;
  forSale: boolean;
  owner: string | null;
  lat: number | null;
  lng: number | null;
  collection: string | null;

  hasStructure: boolean;
  structureType: string | null;
  hasVehicle: boolean;
  vehicleCount: number;

  /** Tier-redacted for Free users; present on Pro+ responses. */
  dealScore: number | null;
  /** Tier-redacted for Free users. */
  isHiddenGem: boolean;

  vehicles?: VehicleDto[];

  /** Optional per-factor breakdown, populated when include=breakdown. */
  dealScoreBreakdown?: {
    undervaluation: number;
    yieldEfficiency: number;
    vehicle: number;
    structure: number;
    liquidity: number;
    rarity: number;
    cityMultiplierDelta: number;
  };
  /** Populated alongside breakdown. Human-readable strings for tooltip. */
  dealScoreReasons?: string[];

  /** Future-reserved NFT metadata slot. Always null today. */
  nftMetadata: null;

  updatedAt: string; // ISO
};

export type PropertyListResponse = {
  items: PropertyDto[];
  nextCursor: string | null;
  total: number;
  facets: {
    priceRange: [number, number] | null;
    yieldRange: [number, number] | null;
  };
  /** Non-null only when the response was trimmed due to a free-tier cap. */
  freeTierCap?: {
    feature: string;
    message: string;
    upsellUrl: string;
  };
};

export type CityFacet = {
  city: string;
  state: string | null;
  country: string;
  propertyCount: number;
  forSaleCount: number;
  withVehicleCount: number;
  withStructureCount: number;
};

export type StatsResponse = {
  total: number;
  forSale: number;
  withVehicles: number;
  withStructures: number;
  hiddenGems: number;
  priceRange: [number, number] | null;
  yieldRange: [number, number] | null;
  lastIngestionAt: string | null;
};

export type SortKey =
  | "recent"
  | "price"
  | "yield"
  | "markup"
  | "vehicles"
  | "deal";

export type SortOrder = "asc" | "desc";
