-- Migration: Add unique constraints on Invoice and Proforma numbers per org
-- Prevents duplicate invoice/proforma numbers from concurrent requests
-- Safe: uses IF NOT EXISTS, idempotent

BEGIN;

-- Invoice number must be unique within an organization
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_orgId_number_key"
  ON "Invoice" ("orgId", "number");

-- Proforma number must be unique within an organization
CREATE UNIQUE INDEX IF NOT EXISTS "Proforma_orgId_number_key"
  ON "Proforma" ("orgId", "number");

-- Customer TIN should be unique within an organization (if not null)
-- This prevents duplicate tax IDs which cause compliance issues
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_orgId_tin_key"
  ON "Customer" ("orgId", "tin")
  WHERE "tin" IS NOT NULL;

COMMIT;
