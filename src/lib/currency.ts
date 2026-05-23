// ─── Currency Registry ─────────────────────────────────────────────────
// Single source of truth for currencies supported across FLUX.
// Used by formatCurrency display, the CurrencyAmountInput component,
// the /api/fx/latest endpoint, and Excel exports.
//
// Standalone — does not import from calculations.ts to keep this module
// safe for use from anywhere without circular-import risk.

function formatNumberLocal(n: number, decimals: number): string {
  // Treat null / NaN / non-finite as zero — but still honor the currency's
  // decimal config so "$0.00" stays "$0.00" instead of degrading to "$0".
  if (n == null || !Number.isFinite(n)) {
    return (0).toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export interface CurrencyDef {
  code: string;       // ISO 4217 code (always uppercase, also used as TSH alias for TZS)
  name: string;       // Display name
  symbol: string;     // Symbol to render before the amount, e.g. "$", "TSh ", "€"
  decimals: number;   // Number of decimals to show
}

// Curated list. Order matters: most common for our African import market first.
export const CURRENCIES: CurrencyDef[] = [
  { code: "USD", name: "US Dollar",         symbol: "$",    decimals: 2 },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh ", decimals: 0 },
  { code: "KES", name: "Kenyan Shilling",    symbol: "KSh ", decimals: 0 },
  { code: "UGX", name: "Ugandan Shilling",   symbol: "USh ", decimals: 0 },
  { code: "NGN", name: "Nigerian Naira",     symbol: "₦",    decimals: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R ",   decimals: 2 },
  { code: "GHS", name: "Ghanaian Cedi",      symbol: "₵",    decimals: 2 },
  { code: "EUR", name: "Euro",               symbol: "€",    decimals: 2 },
  { code: "GBP", name: "Pound Sterling",     symbol: "£",    decimals: 2 },
  { code: "CNY", name: "Chinese Yuan",       symbol: "¥",    decimals: 2 },
  { code: "INR", name: "Indian Rupee",       symbol: "₹",    decimals: 2 },
  { code: "AED", name: "UAE Dirham",         symbol: "AED ", decimals: 2 },
  { code: "JPY", name: "Japanese Yen",       symbol: "¥",    decimals: 0 },
  { code: "XOF", name: "West African CFA",   symbol: "CFA ", decimals: 0 },
  { code: "RWF", name: "Rwandan Franc",      symbol: "RF ",  decimals: 0 },
];

// TSH is a community-used alias for TZS in this codebase — normalize it.
const ALIASES: Record<string, string> = { TSH: "TZS" };

export function normalizeCurrencyCode(code: string | null | undefined): string {
  if (!code) return "USD";
  const upper = code.toUpperCase().trim();
  // Whitespace-only inputs leave us with an empty string after trim — treat
  // that as "no currency provided" and fall back to USD, matching the
  // null/undefined behavior above.
  if (!upper) return "USD";
  return ALIASES[upper] ?? upper;
}

export function getCurrency(code: string | null | undefined): CurrencyDef {
  const normalized = normalizeCurrencyCode(code);
  return CURRENCIES.find((c) => c.code === normalized) ?? {
    // Unknown ISO code — fall back to a generic format so we never silently mis-label as USD.
    code: normalized,
    name: normalized,
    symbol: `${normalized} `,
    decimals: 2,
  };
}

export function getCurrencySymbol(code: string | null | undefined): string {
  return getCurrency(code).symbol;
}

export function getCurrencyDecimals(code: string | null | undefined): number {
  return getCurrency(code).decimals;
}

// Excel-format currency symbol — Excel cells render the leading symbol literally.
export function getCurrencyExcelFormat(code: string | null | undefined): string {
  const c = getCurrency(code);
  // Escape quotes for symbols that already contain a space ("TSh ", "KSh ", "AED ", etc.) — wrap in quotes.
  const sym = c.symbol.includes(" ") || c.symbol.length > 1 ? `"${c.symbol}"` : c.symbol;
  return c.decimals > 0
    ? `${sym}#,##0.${"0".repeat(c.decimals)}`
    : `${sym}#,##0`;
}

// Convert an amount from `fromCode` into `toCode` given an explicit exchange rate.
// The rate is interpreted as: 1 unit of `fromCode` = `rate` units of `toCode`.
export function convertAmount(amount: number, rate: number): number {
  if (!isFinite(amount) || !isFinite(rate) || rate <= 0) return 0;
  return Math.round(amount * rate * 100) / 100;
}

// Format a numeric value using the registered currency definition.
// This is the canonical display path — formatCurrency in lib/calculations.ts delegates here.
export function formatCurrencyValue(amount: number, code: string | null | undefined): string {
  const c = getCurrency(code);
  return `${c.symbol}${formatNumberLocal(amount, c.decimals)}`;
}
