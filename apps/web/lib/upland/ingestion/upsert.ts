// Per-row upsert logic: writes to properties + property_assets + vehicles in
// one transaction, computes deal score inline, and emits change_events rows
// for the n8n fan-out.
//
// This is the hottest path in the ingestion pipeline. Correctness invariants:
//   * One transaction per normalized property -- a partial failure rolls back
//     every side effect for that row so the view never observes a half-written
//     state between mat-view refreshes.
//   * Deal score is computed from the *new* values, not the DB read, so the
//     version always reflects the freshest data.
//   * change_events are written with kind one of:
//       price_changed | listed_for_sale | delisted | new_vehicle |
//       deal_score_jumped | created
//   * Vehicles are idempotently replaced (deleteMany + createMany inside the
//     same tx). For the volumes we expect this is simpler and faster than
//     diff-ing names.

import type { PrismaClient } from "@prisma/client";
import { computeDealScore } from "../deal-score";
import type { NormalizedProperty } from "./sources/PropertySource";

export type UpsertOutcome = {
  created: boolean;
  updated: boolean;
  changeEvents: Array<{ kind: string; oldValue: unknown; newValue: unknown }>;
  dealScore: number | null;
  isHiddenGem: boolean;
};

const DEAL_SCORE_JUMP_THRESHOLD = 10;

export async function upsertNormalizedProperty(
  prisma: PrismaClient,
  n: NormalizedProperty,
  ingestionRunId: string | null,
): Promise<UpsertOutcome> {
  const markupPercentage =
    n.price != null && n.mintPrice != null && n.mintPrice > 0
      ? ((n.price - n.mintPrice) / n.mintPrice) * 100
      : null;

  const scored = computeDealScore({
    price: n.price,
    mintPrice: n.mintPrice,
    markupPercentage,
    yieldPerMonth: n.yieldPerMonth,
    forSale: n.forSale,
    hasVehicle: n.vehicles.length > 0,
    vehicleCount: n.vehicles.length,
    hasStructure: n.hasStructure,
    city: n.city,
    collection: n.collection,
    neighborhood: n.neighborhood,
  });

  return prisma.$transaction(async (tx) => {
    const existing = await tx.property.findUnique({
      where: { uplandId: n.uplandId },
      include: { assets: true, vehicles: true },
    });

    const events: UpsertOutcome["changeEvents"] = [];

    // ---- Build event log before writing -------------------------------
    if (!existing) {
      events.push({ kind: "created", oldValue: null, newValue: { uplandId: n.uplandId, address: n.address } });
    } else {
      const prevPrice = existing.price ? Number(existing.price) : null;
      if (prevPrice != null && n.price != null && Math.abs(prevPrice - n.price) / Math.max(1, prevPrice) > 0.01) {
        events.push({ kind: "price_changed", oldValue: prevPrice, newValue: n.price });
      }
      if (existing.forSale !== n.forSale) {
        events.push({
          kind: n.forSale ? "listed_for_sale" : "delisted",
          oldValue: existing.forSale,
          newValue: n.forSale,
        });
      }
      const prevHadVehicle = Boolean(existing.assets?.hasVehicle);
      if (!prevHadVehicle && n.vehicles.length > 0) {
        events.push({ kind: "new_vehicle", oldValue: null, newValue: { count: n.vehicles.length } });
      }
      if (
        existing.dealScore != null &&
        Math.abs(existing.dealScore - scored.score) >= DEAL_SCORE_JUMP_THRESHOLD
      ) {
        events.push({
          kind: "deal_score_jumped",
          oldValue: existing.dealScore,
          newValue: scored.score,
        });
      }
    }

    // ---- Upsert property ---------------------------------------------
    const property = await tx.property.upsert({
      where: { uplandId: n.uplandId },
      create: {
        uplandId: n.uplandId,
        address: n.address,
        city: n.city,
        state: n.state,
        country: n.country,
        neighborhood: n.neighborhood,
        price: n.price ?? undefined,
        mintPrice: n.mintPrice ?? undefined,
        markupPercentage,
        yieldPerMonth: n.yieldPerMonth ?? undefined,
        forSale: n.forSale,
        owner: n.owner,
        lat: n.lat,
        lng: n.lng,
        collection: n.collection,
        raw: (n.raw ?? null) as never,
        dealScore: scored.score,
        dealScoreVersion: scored.weightsVersion,
        isHiddenGem: scored.isHiddenGem,
        dealScoreUpdatedAt: new Date(),
      },
      update: {
        address: n.address,
        city: n.city,
        state: n.state,
        country: n.country,
        neighborhood: n.neighborhood,
        price: n.price ?? undefined,
        mintPrice: n.mintPrice ?? undefined,
        markupPercentage,
        yieldPerMonth: n.yieldPerMonth ?? undefined,
        forSale: n.forSale,
        owner: n.owner,
        lat: n.lat,
        lng: n.lng,
        collection: n.collection,
        raw: (n.raw ?? null) as never,
        dealScore: scored.score,
        dealScoreVersion: scored.weightsVersion,
        isHiddenGem: scored.isHiddenGem,
        dealScoreUpdatedAt: new Date(),
      },
    });

    // ---- Assets (1:1) -------------------------------------------------
    await tx.propertyAsset.upsert({
      where: { propertyId: property.id },
      create: {
        propertyId: property.id,
        hasStructure: n.hasStructure,
        structureType: n.structureType,
        hasVehicle: n.vehicles.length > 0,
        vehicleCount: n.vehicles.length,
      },
      update: {
        hasStructure: n.hasStructure,
        structureType: n.structureType,
        hasVehicle: n.vehicles.length > 0,
        vehicleCount: n.vehicles.length,
      },
    });

    // ---- Vehicles (replace in full) -----------------------------------
    await tx.vehicle.deleteMany({ where: { propertyId: property.id } });
    if (n.vehicles.length > 0) {
      await tx.vehicle.createMany({
        data: n.vehicles.map((v) => ({
          propertyId: property.id,
          name: v.name,
          type: v.type,
          rarity: v.rarity,
          raw: (v.raw ?? null) as never,
        })),
      });
    }

    // ---- Change events ------------------------------------------------
    if (events.length > 0) {
      await tx.changeEvent.createMany({
        data: events.map((e) => ({
          propertyId: property.id,
          kind: e.kind,
          oldValue: e.oldValue as never,
          newValue: e.newValue as never,
          ingestionRunId,
        })),
      });
    }

    return {
      created: !existing,
      updated: Boolean(existing),
      changeEvents: events,
      dealScore: scored.score,
      isHiddenGem: scored.isHiddenGem,
    };
  });
}
