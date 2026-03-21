-- Add whitepaper_url and explorer_url to coins table.
-- These run automatically on API startup via app/db/migrations.py.
-- Run manually only if needed: psql -U block70 -d block70 -f apps/api/migrations/add_coin_links.sql
ALTER TABLE coins ADD COLUMN IF NOT EXISTS whitepaper_url VARCHAR(1024);
ALTER TABLE coins ADD COLUMN IF NOT EXISTS explorer_url VARCHAR(512);
