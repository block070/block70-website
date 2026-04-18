-- Raw SQL migration for Upland property search:
--   * Composite, partial, and GIN indexes on the base tables.
--   * property_search_view + city_stats_view materialized views.
--   * Unique indexes required by REFRESH MATERIALIZED VIEW CONCURRENTLY.
--   * Deal-score indexes (idx_properties_deal_score, idx_properties_hidden_gem).
--
-- This runs AFTER the Prisma-generated migration that creates the base tables.
-- Supabase supports CREATE INDEX CONCURRENTLY outside of transactions; we
-- keep each statement standalone so Supabase applies them individually.

-- ---- Extensions ----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---- Composite, partial, and specialized indexes on properties ----------
CREATE INDEX IF NOT EXISTS idx_properties_markup_desc
  ON properties (markup_percentage DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_properties_yield_desc
  ON properties (yield_per_month DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_properties_deal_score
  ON properties (deal_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_properties_hidden_gem
  ON properties (deal_score DESC NULLS LAST)
  WHERE is_hidden_gem = true;

CREATE INDEX IF NOT EXISTS idx_properties_city_for_sale
  ON properties (city, for_sale);

-- Partial: the for-sale subset is tiny, this index is a fraction of the full size.
CREATE INDEX IF NOT EXISTS idx_properties_for_sale_price
  ON properties (for_sale, price)
  WHERE for_sale = true;

CREATE INDEX IF NOT EXISTS idx_properties_address_trgm
  ON properties USING GIN (address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_properties_neighborhood_trgm
  ON properties USING GIN (neighborhood gin_trgm_ops);

-- ---- Property asset indexes ---------------------------------------------
CREATE INDEX IF NOT EXISTS idx_property_assets_has_vehicle
  ON property_assets (has_vehicle)
  WHERE has_vehicle = true;

CREATE INDEX IF NOT EXISTS idx_property_assets_has_structure
  ON property_assets (has_structure)
  WHERE has_structure = true;

-- ---- Change events partial index for the n8n webhook fan-out -----------
CREATE INDEX IF NOT EXISTS idx_change_events_unprocessed
  ON change_events (created_at)
  WHERE processed_at IS NULL;

-- =========================================================================
-- property_search_view — primary read path for the search page
-- =========================================================================
DROP MATERIALIZED VIEW IF EXISTS property_search_view;

CREATE MATERIALIZED VIEW property_search_view AS
SELECT
  p.id,
  p.address,
  p.city,
  p.state,
  p.country,
  p.neighborhood,
  p.price,
  p.mint_price,
  p.markup_percentage,
  p.yield_per_month,
  p.for_sale,
  p.owner,
  p.lat,
  p.lng,
  COALESCE(a.has_structure, false)  AS has_structure,
  a.structure_type                  AS structure_type,
  COALESCE(a.has_vehicle,   false)  AS has_vehicle,
  COALESCE(a.vehicle_count, 0)      AS vehicle_count,
  p.deal_score,
  p.is_hidden_gem,
  GREATEST(p.updated_at, COALESCE(a.updated_at, p.updated_at)) AS updated_at
FROM properties p
LEFT JOIN property_assets a ON a.property_id = p.id;

-- Unique index is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS property_search_view_id_uidx
  ON property_search_view (id);

CREATE INDEX IF NOT EXISTS idx_psv_city_for_sale
  ON property_search_view (city, for_sale);

CREATE INDEX IF NOT EXISTS idx_psv_city_has_vehicle
  ON property_search_view (city, has_vehicle);

CREATE INDEX IF NOT EXISTS idx_psv_for_sale_price
  ON property_search_view (for_sale, price)
  WHERE for_sale = true;

CREATE INDEX IF NOT EXISTS idx_psv_for_sale_vehicle
  ON property_search_view (for_sale, has_vehicle)
  WHERE for_sale = true;

CREATE INDEX IF NOT EXISTS idx_psv_markup_desc
  ON property_search_view (markup_percentage DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_psv_yield_desc
  ON property_search_view (yield_per_month DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_psv_deal_score
  ON property_search_view (deal_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_psv_hidden_gem
  ON property_search_view (deal_score DESC NULLS LAST)
  WHERE is_hidden_gem = true;

CREATE INDEX IF NOT EXISTS idx_psv_address_trgm
  ON property_search_view USING GIN (address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_psv_neighborhood_trgm
  ON property_search_view USING GIN (neighborhood gin_trgm_ops);

-- =========================================================================
-- city_stats_view — small mat view driving the city multi-select
-- =========================================================================
DROP MATERIALIZED VIEW IF EXISTS city_stats_view;

CREATE MATERIALIZED VIEW city_stats_view AS
SELECT
  p.city,
  p.state,
  p.country,
  COUNT(*)                                      AS property_count,
  COUNT(*) FILTER (WHERE p.for_sale)            AS for_sale_count,
  COUNT(*) FILTER (WHERE a.has_vehicle)         AS with_vehicle_count,
  COUNT(*) FILTER (WHERE a.has_structure)       AS with_structure_count
FROM properties p
LEFT JOIN property_assets a ON a.property_id = p.id
GROUP BY p.city, p.state, p.country;

CREATE UNIQUE INDEX IF NOT EXISTS city_stats_view_key_uidx
  ON city_stats_view (city, COALESCE(state, ''), country);
