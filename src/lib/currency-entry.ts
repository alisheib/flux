// ─── Currency-entry helpers (server-side) ─────────────────────────────
// The inventory/shipment forms can send an optional `entry` payload alongside
// each money field — { amount, currency, rate } — when the user typed a price
// in a non-org currency. These helpers parse, validate, and normalize that
// payload before persistence.
//
// The contract:
//   • The money column itself (e.g. Product.costPrice) always holds the
//     converted org-currency value.
//   • The {entryCurrency, entryAmount, entryRate} columns capture the
//     foreign-currency entry. If the user typed in the org currency
//     directly, all three are NULL.
//   • A partial entry (e.g. currency without rate) is rejected. The form
//     blocks submit in that state, but the server validates as a second
//     line of defense.

import { normalizeCurrencyCode } from "@/lib/currency";

export interface CurrencyEntryInput {
  amount?: unknown;
  currency?: unknown;
  rate?: unknown;
}

export interface CurrencyEntryColumns {
  entryCurrency: string | null;
  entryAmount: number | null;
  entryRate: number | null;
}

// Discriminated union — use `type` (interface can't be a union).
export type ParseResult =
  | { ok: true; columns: CurrencyEntryColumns }
  | { ok: false; error: string };

// Parse a single entry payload. Accepts:
//   • undefined / null      → all three columns null (clears the entry)
//   • {} (empty object)     → all three columns null
//   • { amount, currency, rate } with valid values → returns those
//   • Anything else         → ok:false
//
// "Valid" means amount is a non-negative finite number, currency is a
// non-empty string after trim, and rate is a positive finite number.
export function parseCurrencyEntry(input: CurrencyEntryInput | null | undefined, fieldLabel: string): ParseResult {
  if (input === undefined || input === null) {
    return { ok: true, columns: { entryCurrency: null, entryAmount: null, entryRate: null } };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: `${fieldLabel}: entry must be an object` };
  }

  const hasAny =
    input.amount !== undefined || input.currency !== undefined || input.rate !== undefined;
  if (!hasAny) {
    return { ok: true, columns: { entryCurrency: null, entryAmount: null, entryRate: null } };
  }

  // All three must be present together. Reject partials.
  if (input.amount === undefined || input.currency === undefined || input.rate === undefined) {
    return { ok: false, error: `${fieldLabel}: entry must include amount, currency, and rate together` };
  }

  if (typeof input.amount !== "number" || !isFinite(input.amount) || input.amount < 0) {
    return { ok: false, error: `${fieldLabel}: entry amount must be a non-negative finite number` };
  }
  if (typeof input.rate !== "number" || !isFinite(input.rate) || input.rate <= 0) {
    return { ok: false, error: `${fieldLabel}: entry rate must be a positive finite number` };
  }
  if (typeof input.currency !== "string") {
    return { ok: false, error: `${fieldLabel}: entry currency must be a string` };
  }
  const normalizedCurrency = normalizeCurrencyCode(input.currency);
  if (!normalizedCurrency) {
    return { ok: false, error: `${fieldLabel}: entry currency cannot be empty` };
  }
  // Cap the stored currency code length to avoid junk filling the column.
  if (normalizedCurrency.length > 8) {
    return { ok: false, error: `${fieldLabel}: entry currency code too long` };
  }

  return {
    ok: true,
    columns: {
      entryCurrency: normalizedCurrency,
      entryAmount: input.amount,
      entryRate: input.rate,
    },
  };
}

// Format an entry for audit log output. Returns null if there's nothing
// foreign-currency-ish to log.
export function formatEntryForAudit(label: string, cols: CurrencyEntryColumns): string | null {
  if (cols.entryCurrency == null || cols.entryAmount == null || cols.entryRate == null) {
    return null;
  }
  return `${label} entered as ${cols.entryAmount} ${cols.entryCurrency} @ rate ${cols.entryRate}`;
}
