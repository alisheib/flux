-- =====================================================================
-- Add Proforma + ProformaItem tables + OrgSettings proforma config
-- Generated: 2026-05-29
--
-- WHAT THIS DOES
-- Adds the proforma invoice module:
--   • Proforma table — quotes sent to customers before a sale closes
--   • ProformaItem table — line items
--   • Three new columns on OrgSettings:
--       proformaPrefix       (default "PRO")
--       proformaNextNum      (default 1)
--       proformaValidityDays (default 14)
--
-- WHY IT'S SAFE TO RUN ON LIVE DATA
-- • Only adds new tables and nullable / defaulted columns. No existing data
--   is touched. No constraints are added to existing tables.
-- • Wrapped in a transaction; failure rolls back cleanly.
-- • Uses IF NOT EXISTS so the script is idempotent.
--
-- HOW TO APPLY
-- Option A (recommended):
--     npx prisma db push     # syncs schema.prisma to the live DB
-- Option B (manual):
--     Paste the SQL below into the Neon SQL editor and run.
-- =====================================================================

BEGIN;

-- ─── OrgSettings proforma config columns ─────────────────────────────
ALTER TABLE "OrgSettings" ADD COLUMN IF NOT EXISTS "proformaPrefix"       TEXT     NOT NULL DEFAULT 'PRO';
ALTER TABLE "OrgSettings" ADD COLUMN IF NOT EXISTS "proformaNextNum"      INTEGER  NOT NULL DEFAULT 1;
ALTER TABLE "OrgSettings" ADD COLUMN IF NOT EXISTS "proformaValidityDays" INTEGER  NOT NULL DEFAULT 14;

-- ─── Proforma table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Proforma" (
  "id"                   TEXT             NOT NULL,
  "orgId"                TEXT             NOT NULL,
  "customerId"           TEXT,
  "number"               TEXT             NOT NULL,
  "customer"             TEXT             NOT NULL,
  "customerPhone"        TEXT,
  "customerEmail"        TEXT,
  "customerAddress"      TEXT,
  "customerTin"          TEXT,
  "subtotal"             DOUBLE PRECISION NOT NULL,
  "taxRate"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "taxAmount"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total"                DOUBLE PRECISION NOT NULL,
  "currency"             TEXT             NOT NULL,
  "status"               TEXT             NOT NULL DEFAULT 'draft',
  "issuedAt"             TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil"           TIMESTAMP(3)     NOT NULL,
  "convertedToInvoiceId" TEXT,
  "convertedAt"          TIMESTAMP(3),
  "notes"                TEXT,
  "entryCurrency"        TEXT,
  "entryRate"            DOUBLE PRECISION,
  "createdAt"            TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "Proforma_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (use DO blocks so we don't error if the constraint already exists)
DO $$ BEGIN
  ALTER TABLE "Proforma" ADD CONSTRAINT "Proforma_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Proforma" ADD CONSTRAINT "Proforma_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Proforma" ADD CONSTRAINT "Proforma_convertedToInvoiceId_fkey"
    FOREIGN KEY ("convertedToInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Proforma_convertedToInvoiceId_key" ON "Proforma"("convertedToInvoiceId");
CREATE INDEX        IF NOT EXISTS "Proforma_orgId_idx"                ON "Proforma"("orgId");
CREATE INDEX        IF NOT EXISTS "Proforma_orgId_status_idx"         ON "Proforma"("orgId", "status");
CREATE INDEX        IF NOT EXISTS "Proforma_customerId_idx"           ON "Proforma"("customerId");

-- ─── ProformaItem table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ProformaItem" (
  "id"          TEXT             NOT NULL,
  "proformaId"  TEXT             NOT NULL,
  "productId"   TEXT,
  "name"        TEXT             NOT NULL,
  "quantity"    DOUBLE PRECISION NOT NULL,
  "unitPrice"   DOUBLE PRECISION NOT NULL,
  "total"       DOUBLE PRECISION NOT NULL,
  "sellingUnit" TEXT             NOT NULL DEFAULT 'unit',
  "area"        DOUBLE PRECISION,

  CONSTRAINT "ProformaItem_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ProformaItem" ADD CONSTRAINT "ProformaItem_proformaId_fkey"
    FOREIGN KEY ("proformaId") REFERENCES "Proforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProformaItem" ADD CONSTRAINT "ProformaItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ProformaItem_proformaId_idx" ON "ProformaItem"("proformaId");
CREATE INDEX IF NOT EXISTS "ProformaItem_productId_idx"  ON "ProformaItem"("productId");

COMMIT;

-- =====================================================================
-- Verification (run after to confirm):
--
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN ('Proforma', 'ProformaItem');
-- -- expected: 2 rows
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'OrgSettings'
--   AND column_name LIKE 'proforma%'
-- ORDER BY column_name;
-- -- expected: proformaNextNum, proformaPrefix, proformaValidityDays
-- =====================================================================
