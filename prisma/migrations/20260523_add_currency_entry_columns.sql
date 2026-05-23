-- =====================================================================
-- Add foreign-currency entry metadata columns
-- Generated: 2026-05-23
--
-- WHAT THIS DOES
-- Adds nullable columns to five tables so the system can persist what the
-- user originally typed when entering a price in a non-org currency:
--   Product           (3 amount fields × 3 columns each = 9 columns)
--   ShipmentItem      (3 columns)
--   ShipmentExpense   (2 columns — amountLocal already holds the raw value)
--   PurchaseOrderItem (3 columns)
--   Payment           (3 columns)
--
-- WHY IT'S SAFE TO RUN ON LIVE DATA
-- • Every new column is NULLABLE with no default. Pre-existing rows stay
--   valid — they simply have NULL on these columns until the next update.
-- • No constraints, no foreign keys, no index changes — pure additive DDL.
-- • Wrapped in a transaction. Any failure rolls everything back.
-- • Uses IF NOT EXISTS guards so the script is idempotent: running it twice
--   is a no-op the second time.
--
-- HOW TO APPLY
-- Option A (recommended, lets Prisma manage the change):
--     npx prisma db push   # syncs schema.prisma to the database
--
-- Option B (manual, paste into Neon SQL editor):
--     Copy the SQL below and run it once.
-- =====================================================================

BEGIN;

-- ─── Product ─────────────────────────────────────────────────────────
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "costEntryCurrency"        TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "costEntryAmount"          DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "costEntryRate"            DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sellingEntryCurrency"     TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sellingEntryAmount"       DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sellingEntryRate"         DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "pricePerSqmEntryCurrency" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "pricePerSqmEntryAmount"   DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "pricePerSqmEntryRate"     DOUBLE PRECISION;

-- ─── ShipmentItem ────────────────────────────────────────────────────
ALTER TABLE "ShipmentItem" ADD COLUMN IF NOT EXISTS "entryCurrency" TEXT;
ALTER TABLE "ShipmentItem" ADD COLUMN IF NOT EXISTS "entryAmount"   DOUBLE PRECISION;
ALTER TABLE "ShipmentItem" ADD COLUMN IF NOT EXISTS "entryRate"     DOUBLE PRECISION;

-- ─── ShipmentExpense ─────────────────────────────────────────────────
-- amountLocal already holds the raw foreign amount; we add currency + rate.
ALTER TABLE "ShipmentExpense" ADD COLUMN IF NOT EXISTS "entryCurrency" TEXT;
ALTER TABLE "ShipmentExpense" ADD COLUMN IF NOT EXISTS "entryRate"     DOUBLE PRECISION;

-- ─── PurchaseOrderItem ───────────────────────────────────────────────
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "entryCurrency" TEXT;
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "entryAmount"   DOUBLE PRECISION;
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "entryRate"     DOUBLE PRECISION;

-- ─── Payment ─────────────────────────────────────────────────────────
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "entryCurrency" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "entryAmount"   DOUBLE PRECISION;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "entryRate"     DOUBLE PRECISION;

-- ─── Drop legacy hardcoded defaults ─────────────────────────────────
-- Older schema baked Tanzania-specific values into Postgres column defaults:
--   Shipment.exchangeRate     defaulted to 2630 (TZS/USD spot rate)
--   OrgSettings.exchangeRate  defaulted to 2630
--   Organization.taxLabel     defaulted to "TVA" (French)
-- These leaked TZ-specific bias into every new row. The schema now uses
-- neutral defaults (rate=1, taxLabel="VAT"). Pre-existing rows keep their
-- current values; only NEW rows pick up the neutral defaults.
ALTER TABLE "Shipment"     ALTER COLUMN "exchangeRate" SET DEFAULT 1;
ALTER TABLE "OrgSettings"  ALTER COLUMN "exchangeRate" SET DEFAULT 1;
ALTER TABLE "Organization" ALTER COLUMN "taxLabel"     SET DEFAULT 'VAT';

COMMIT;

-- =====================================================================
-- Verification queries (optional — run after the migration to confirm)
-- =====================================================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'Product' AND column_name LIKE '%Entry%'
-- ORDER BY column_name;
--
-- Expected output: 9 rows
--   costEntryAmount, costEntryCurrency, costEntryRate,
--   pricePerSqmEntryAmount, pricePerSqmEntryCurrency, pricePerSqmEntryRate,
--   sellingEntryAmount, sellingEntryCurrency, sellingEntryRate
-- =====================================================================
