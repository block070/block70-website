-- Add seller_type to properties (nullable) and rebuild property_search_view
-- so the column is exposed to the read path.
--
-- seller_type values:
--   'player' -> listed on Upland's player marketplace ("For sale" status)
--   'mint'   -> mintable directly from Upland ("Unlocked" status)
--   NULL     -> owned / locked / not listed
--
-- PostgreSQL does not support ALTER MATERIALIZED VIEW ... ADD COLUMN, so we
-- DROP + CREATE the view. Every index that lives on the view is recreated
-- afterwards to avoid a search-path regression.

-- ---- Base table ---------------------------------------------------------
ALTER TABLE properties ADD COLUMN IF NOT EXISTS seller_type TEXT;

CREATE INDEX IF NOT EXISTS idx_properties_seller_type
  ON properties (seller_type)
  WHERE seller_type IS NOT NULL;

-- ---- Rebuild property_search_view --------------------------------------
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
  p.seller_type,
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

-- REFRESH MATERIALIZED VIEW CONCURRENTLY requires a unique index.
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

CREATE INDEX IF NOT EXISTS idx_psv_seller_type
  ON property_search_view (seller_type)
  WHERE seller_type IS NOT NULL;

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
