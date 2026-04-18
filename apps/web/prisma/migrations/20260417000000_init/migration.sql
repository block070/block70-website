-- Baseline migration: creates the Upland property search tables that the
-- 20260418000000_upland_indexes_and_views migration decorates with indexes
-- and materialized views.

-- ---- properties ---------------------------------------------------------
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "upland_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "neighborhood" TEXT,
    "price" DECIMAL(20,6),
    "mint_price" DECIMAL(20,6),
    "markup_percentage" DOUBLE PRECISION,
    "yield_per_month" DECIMAL(20,6),
    "for_sale" BOOLEAN NOT NULL DEFAULT false,
    "owner" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "collection" TEXT,
    "raw" JSONB,
    "deal_score" DOUBLE PRECISION,
    "deal_score_version" INTEGER,
    "is_hidden_gem" BOOLEAN NOT NULL DEFAULT false,
    "deal_score_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "properties_upland_id_key" ON "properties"("upland_id");
CREATE INDEX "properties_city_idx"         ON "properties"("city");
CREATE INDEX "properties_neighborhood_idx" ON "properties"("neighborhood");
CREATE INDEX "properties_for_sale_idx"     ON "properties"("for_sale");
CREATE INDEX "properties_price_idx"        ON "properties"("price");
CREATE INDEX "properties_owner_idx"        ON "properties"("owner");

-- ---- property_assets (1:1 with properties) ------------------------------
CREATE TABLE "property_assets" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "has_structure" BOOLEAN NOT NULL DEFAULT false,
    "structure_type" TEXT,
    "has_vehicle" BOOLEAN NOT NULL DEFAULT false,
    "vehicle_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "property_assets_property_id_key" ON "property_assets"("property_id");

ALTER TABLE "property_assets"
    ADD CONSTRAINT "property_assets_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- vehicles (many-to-1 with properties) -------------------------------
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "rarity" TEXT,
    "raw" JSONB,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vehicles_property_id_idx" ON "vehicles"("property_id");
CREATE INDEX "vehicles_rarity_idx"      ON "vehicles"("rarity");

ALTER TABLE "vehicles"
    ADD CONSTRAINT "vehicles_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- ingestion_runs -----------------------------------------------------
CREATE TABLE "ingestion_runs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "properties_seen" INTEGER NOT NULL DEFAULT 0,
    "properties_upserted" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ingestion_runs_source_started_at_idx"
    ON "ingestion_runs"("source", "started_at");

-- ---- change_events (many-to-1 with properties, drives n8n fan-out) ------
CREATE TABLE "change_events" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "ingestion_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "webhook_status" TEXT,

    CONSTRAINT "change_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "change_events_property_id_created_at_idx"
    ON "change_events"("property_id", "created_at" DESC);

ALTER TABLE "change_events"
    ADD CONSTRAINT "change_events_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
