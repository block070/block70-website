// Batch re-scoring helper used by the admin recompute endpoint.
//
// Streams properties + their 1:1 assets in pages, calls computeDealScore,
// and bulk-updates rows in a single transaction per page. Safe to run
// concurrently with ingestion: ingestion holds row-level locks only on the
// individual upserts it touches; this helper re-reads fresh data on every
// page so conflicts resolve naturally.
//
// The caller (the API route) is responsible for:
//   * authenticating the request (UPLAND_DEAL_SCORE_SECRET header)
//   * triggering REFRESH MATERIALIZED VIEW CONCURRENTLY after the last page.

import type { PrismaClient } from "@prisma/client";
import { computeDealScore } from "./compute";
import { DEAL_SCORE_WEIGHTS, type DealScoreWeights } from "./weights";
import type { DealScoreInput } from "./types";

export type RecomputeOptions = {
  /** Skip rows already at or above this weights version. */
  sinceVersion?: number;
  /** Only rescore rows with a NULL deal_score. */
  onlyNullScore?: boolean;
  /** Max properties processed in one call (safety cap). */
  limit?: number;
  /** Rows per transaction. */
  pageSize?: number;
};

export type RecomputeStats = {
  scanned: number;
  updated: number;
  unchanged: number;
  pagesProcessed: number;
  weightsVersion: number;
  completed: boolean;
};

type PropertyRow = {
  id: string;
  city: string;
  neighborhood: string | null;
  price: unknown;
  mintPrice: unknown;
  markupPercentage: number | null;
  yieldPerMonth: unknown;
  forSale: boolean;
  collection: string | null;
  dealScore: number | null;
  dealScoreVersion: number | null;
  assets: {
    hasStructure: boolean;
    hasVehicle: boolean;
    vehicleCount: number;
  } | null;
};

export async function recomputeDealScores(
  prisma: PrismaClient,
  opts: RecomputeOptions = {},
  weights: DealScoreWeights = DEAL_SCORE_WEIGHTS,
): Promise<RecomputeStats> {
  const limit = Math.max(1, Math.min(opts.limit ?? 50_000, 500_000));
  const pageSize = Math.max(50, Math.min(opts.pageSize ?? 500, 2_000));
  const sinceVersion = opts.sinceVersion ?? weights.version;

  const stats: RecomputeStats = {
    scanned: 0,
    updated: 0,
    unchanged: 0,
    pagesProcessed: 0,
    weightsVersion: weights.version,
    completed: false,
  };

  let cursor: string | undefined;

  while (stats.scanned < limit) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prisma types include via include
    const rows: PropertyRow[] = (await prisma.property.findMany({
      where: opts.onlyNullScore
        ? { dealScore: null }
        : {
            OR: [
              { dealScoreVersion: null },
              { dealScoreVersion: { lt: sinceVersion } },
            ],
          },
      orderBy: { id: "asc" },
      take: Math.min(pageSize, limit - stats.scanned),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        city: true,
        neighborhood: true,
        price: true,
        mintPrice: true,
        markupPercentage: true,
        yieldPerMonth: true,
        forSale: true,
        collection: true,
        dealScore: true,
        dealScoreVersion: true,
        assets: {
          select: {
            hasStructure: true,
            hasVehicle: true,
            vehicleCount: true,
          },
        },
      },
    })) as unknown as PropertyRow[];

    if (rows.length === 0) {
      stats.completed = true;
      break;
    }

    await prisma.$transaction(
      rows.map((row) => {
        const input = toScoreInput(row);
        const result = computeDealScore(input, weights);
        stats.scanned += 1;
        if (
          row.dealScore != null &&
          Math.abs(row.dealScore - result.score) < 0.01 &&
          row.dealScoreVersion === result.weightsVersion
        ) {
          stats.unchanged += 1;
        } else {
          stats.updated += 1;
        }
        return prisma.property.update({
          where: { id: row.id },
          data: {
            dealScore: result.score,
            dealScoreVersion: result.weightsVersion,
            isHiddenGem: result.isHiddenGem,
            dealScoreUpdatedAt: new Date(),
          },
        });
      }),
    );

    stats.pagesProcessed += 1;
    cursor = rows[rows.length - 1]?.id;

    if (rows.length < pageSize) {
      stats.completed = true;
      break;
    }
  }

  return stats;
}

function toScoreInput(row: PropertyRow): DealScoreInput {
  return {
    price: row.price as DealScoreInput["price"],
    mintPrice: row.mintPrice as DealScoreInput["mintPrice"],
    markupPercentage: row.markupPercentage,
    yieldPerMonth: row.yieldPerMonth as DealScoreInput["yieldPerMonth"],
    forSale: row.forSale,
    hasVehicle: row.assets?.hasVehicle ?? false,
    vehicleCount: row.assets?.vehicleCount ?? 0,
    hasStructure: row.assets?.hasStructure ?? false,
    city: row.city,
    collection: row.collection,
    neighborhood: row.neighborhood,
  };
}
