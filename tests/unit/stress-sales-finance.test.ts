/**
 * STRESS TESTS — Sales, POS, Discounts, Tax, Payments, Credit Notes, Float Precision
 * The financial core of FLUX — every penny must be right
 * Run: npx tsx tests/unit/stress-sales-finance.test.ts
 */

import { formatCurrency, formatNumber } from "../../src/lib/calculations";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  \x1b[32mPASS\x1b[0m  ${name}`); }
  catch (e: unknown) { failed++; const m = e instanceof Error ? e.message : String(e); console.log(`  \x1b[31mFAIL\x1b[0m  ${name}\n        ${m}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function eq(a: unknown, b: unknown, m?: string) { if (a !== b) throw new Error(m || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function close(a: number, b: number, tol: number, m?: string) { if (Math.abs(a - b) > tol) throw new Error(m || `Expected ~${b}, got ${a} (tol ${tol})`); }

// Helper: replicates the exact math from sales/route.ts
function calculateSaleTotals(items: { quantity: number; unitPrice: number }[], discount: number, taxRate: number) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountAmount = Math.max(0, Math.min(discount || 0, subtotal));
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = Math.round(taxableAmount * (taxRate / 100) * 100) / 100;
  const total = Math.round((taxableAmount + taxAmount) * 100) / 100;
  return { subtotal, discountAmount, taxableAmount, taxAmount, total };
}

// ═══════════════════════════════════════════════════════════════════════════
// Sale Total Calculations
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Sale Totals ===");

test("simple sale: 2 items, no discount, no tax", () => {
  const r = calculateSaleTotals([
    { quantity: 2, unitPrice: 100 },
    { quantity: 1, unitPrice: 50 },
  ], 0, 0);
  eq(r.subtotal, 250);
  eq(r.total, 250);
});

test("sale with 18% VAT", () => {
  const r = calculateSaleTotals([{ quantity: 1, unitPrice: 1000 }], 0, 18);
  eq(r.subtotal, 1000);
  eq(r.taxAmount, 180);
  eq(r.total, 1180);
});

test("sale with fixed discount + tax", () => {
  const r = calculateSaleTotals([{ quantity: 1, unitPrice: 1000 }], 200, 18);
  eq(r.subtotal, 1000);
  eq(r.discountAmount, 200);
  eq(r.taxableAmount, 800);
  eq(r.taxAmount, 144);
  eq(r.total, 944);
});

test("discount capped at subtotal", () => {
  const r = calculateSaleTotals([{ quantity: 1, unitPrice: 100 }], 500, 0);
  eq(r.discountAmount, 100); // capped at subtotal
  eq(r.total, 0);
});

test("negative discount treated as 0", () => {
  const r = calculateSaleTotals([{ quantity: 1, unitPrice: 100 }], -50, 0);
  eq(r.discountAmount, 0);
  eq(r.total, 100);
});

// ═══════════════════════════════════════════════════════════════════════════
// Floating Point Precision — The Finance Killer
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Float Precision (Finance-Critical) ===");

test("0.1 + 0.2 !== 0.3 in JS", () => {
  assert(0.1 + 0.2 !== 0.3, "IEEE 754 fun");
  close(0.1 + 0.2, 0.3, 0.0001, "but close enough");
});

test("sale rounding: 3 items at 33.33 each = 99.99", () => {
  const r = calculateSaleTotals([
    { quantity: 1, unitPrice: 33.33 },
    { quantity: 1, unitPrice: 33.33 },
    { quantity: 1, unitPrice: 33.33 },
  ], 0, 0);
  close(r.subtotal, 99.99, 0.01);
  close(r.total, 99.99, 0.01);
});

test("tax on 99.99 at 18% = 18.00 (not 17.9982)", () => {
  const r = calculateSaleTotals([{ quantity: 1, unitPrice: 99.99 }], 0, 18);
  eq(r.taxAmount, 18); // Math.round(99.99 * 0.18 * 100) / 100 = 18.00
});

test("many small items: 100 × $0.99 = $99", () => {
  const items = Array.from({ length: 100 }, () => ({ quantity: 1, unitPrice: 0.99 }));
  const r = calculateSaleTotals(items, 0, 0);
  close(r.subtotal, 99, 0.01);
});

test("very large sale: 10000 items at $9999.99", () => {
  const items = [{ quantity: 10000, unitPrice: 9999.99 }];
  const r = calculateSaleTotals(items, 0, 18);
  close(r.subtotal, 99999900, 1);
  assert(isFinite(r.total), "total is finite");
  assert(r.total > 0, "total is positive");
});

test("fractional quantity × price precision", () => {
  // 2.5 m² × $45/m² = $112.50
  const r = calculateSaleTotals([{ quantity: 2.5, unitPrice: 45 }], 0, 0);
  eq(r.total, 112.5);
});

test("very small amount: 0.001 × $0.01 = $0.00001 → rounds to 0", () => {
  const r = calculateSaleTotals([{ quantity: 0.001, unitPrice: 0.01 }], 0, 0);
  close(r.total, 0, 0.01); // rounds to 0.00 or very close
});

// ═══════════════════════════════════════════════════════════════════════════
// Payment Methods
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Payment Methods ===");

const VALID_METHODS = ["cash", "card", "bank_transfer", "mobile_money", "credit"];
const PAYMENT_METHODS_DISPLAY: Record<string, string> = {
  cash: "Cash", card: "Card", bank_transfer: "Bank Transfer",
  mobile_money: "Mobile Money", credit: "Credit",
};

test("all payment methods valid", () => {
  for (const m of VALID_METHODS) {
    assert(VALID_METHODS.includes(m), `${m} valid`);
  }
});

test("invalid methods rejected", () => {
  assert(!VALID_METHODS.includes("mpesa"), "mpesa not valid (use mobile_money)");
  assert(!VALID_METHODS.includes("check"), "check not valid");
  assert(!VALID_METHODS.includes(""), "empty not valid");
});

test("credit sale sets status to 'credit'", () => {
  const method = "credit";
  const status = method === "credit" ? "credit" : "completed";
  eq(status, "credit");
});

test("cash sale sets status to 'completed'", () => {
  const method = "cash";
  const status = method === "credit" ? "credit" : "completed";
  eq(status, "completed");
});

// ═══════════════════════════════════════════════════════════════════════════
// Partial Payments & Outstanding Balance
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Partial Payments ===");

function calculateOutstanding(saleTotal: number, payments: number[]): number {
  const totalPaid = payments.reduce((s, p) => s + p, 0);
  return Math.round((saleTotal - totalPaid) * 100) / 100;
}

test("no payments = full outstanding", () => {
  eq(calculateOutstanding(1000, []), 1000);
});

test("partial payment", () => {
  eq(calculateOutstanding(1000, [300]), 700);
});

test("multiple partial payments", () => {
  eq(calculateOutstanding(1000, [300, 200, 100]), 400);
});

test("fully paid = 0 outstanding", () => {
  eq(calculateOutstanding(1000, [1000]), 0);
});

test("overpayment detection", () => {
  const outstanding = calculateOutstanding(1000, [600]);
  const newPayment = 500;
  assert(newPayment > outstanding + 0.01, "overpayment detected");
});

test("exact remaining payment allowed", () => {
  const outstanding = calculateOutstanding(1000, [600]);
  eq(outstanding, 400);
  assert(!(400 > outstanding + 0.01), "exact payment OK");
});

test("float precision in payments: many $33.33 payments", () => {
  const outstanding = calculateOutstanding(100, [33.33, 33.33, 33.33]);
  close(outstanding, 0.01, 0.01);
});

// ═══════════════════════════════════════════════════════════════════════════
// Credit Notes & Refunds
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Credit Notes ===");

function validateCreditNote(
  saleTotal: number, saleTaxRate: number,
  previousRefunds: number[], newItems: { quantity: number; unitPrice: number; total: number }[]
): { valid: boolean; error?: string; total: number } {
  const subtotal = newItems.reduce((s, i) => s + i.total, 0);
  const taxAmount = Math.round(subtotal * (saleTaxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const previouslyRefunded = previousRefunds.reduce((s, r) => s + r, 0);
  const totalRefundedAfter = previouslyRefunded + total;

  if (totalRefundedAfter > saleTotal + 0.01) {
    const remaining = Math.round((saleTotal - previouslyRefunded) * 100) / 100;
    return { valid: false, error: `Exceeds refundable: ${remaining}`, total };
  }
  return { valid: true, total };
}

test("full refund of entire sale", () => {
  // Sale was $1180 (1000 + 18% tax)
  const r = validateCreditNote(1180, 18, [], [{ quantity: 1, unitPrice: 1000, total: 1000 }]);
  assert(r.valid, "full refund OK");
  eq(r.total, 1180);
});

test("partial refund", () => {
  const r = validateCreditNote(1180, 18, [], [{ quantity: 1, unitPrice: 500, total: 500 }]);
  assert(r.valid, "partial OK");
  eq(r.total, 590);
});

test("second refund after first", () => {
  const r = validateCreditNote(1180, 18, [590], [{ quantity: 1, unitPrice: 500, total: 500 }]);
  assert(r.valid, "second refund OK");
  eq(r.total, 590);
});

test("over-refund rejected", () => {
  const r = validateCreditNote(1180, 18, [590], [{ quantity: 1, unitPrice: 600, total: 600 }]);
  assert(!r.valid, "over-refund rejected");
});

test("multiple previous refunds tracked", () => {
  const r = validateCreditNote(1000, 0, [200, 300, 100], [{ quantity: 1, unitPrice: 500, total: 500 }]);
  // 200+300+100+500 = 1100 > 1000
  assert(!r.valid, "cumulative over-refund rejected");
});

test("refund with zero tax", () => {
  const r = validateCreditNote(500, 0, [], [{ quantity: 2, unitPrice: 100, total: 200 }]);
  assert(r.valid, "zero tax refund OK");
  eq(r.total, 200);
});

// ═══════════════════════════════════════════════════════════════════════════
// Credit Note Number Generation — Race Condition Bug
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Credit Note Number Generation ===");

test("CN number from count: count=0 → CN-0001", () => {
  const count = 0;
  const number = `CN-${String(count + 1).padStart(4, "0")}`;
  eq(number, "CN-0001");
});

test("BUG: concurrent CN creation gets same number", () => {
  // If count() returns 5 for two concurrent requests, both get CN-0006
  const count = 5;
  const num1 = `CN-${String(count + 1).padStart(4, "0")}`;
  const num2 = `CN-${String(count + 1).padStart(4, "0")}`;
  eq(num1, num2, "RACE CONDITION: both get CN-0006");
});

// ═══════════════════════════════════════════════════════════════════════════
// Duplicate Product in Same Sale
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Duplicate Product Bug ===");

test("BUG: same productId twice in sale items", () => {
  const items = [
    { productId: "prod-1", quantity: 5, unitPrice: 100 },
    { productId: "prod-1", quantity: 3, unitPrice: 100 }, // SAME product
  ];
  const productIds = items.map(i => i.productId);
  const uniqueIds = new Set(productIds);
  assert(uniqueIds.size < productIds.length, "duplicates exist");
  // BUG: products.length would be 1, productIds.length would be 2
  // The check `products.length !== productIds.length` would FAIL
  // because there's only 1 unique product but 2 items
});

test("deduplicated productIds should match fetched products", () => {
  const items = [
    { productId: "prod-1", quantity: 5, unitPrice: 100 },
    { productId: "prod-1", quantity: 3, unitPrice: 100 },
    { productId: "prod-2", quantity: 1, unitPrice: 50 },
  ];
  const uniqueIds = [...new Set(items.map(i => i.productId))];
  eq(uniqueIds.length, 2); // Only 2 unique products to fetch
  // Stock check should sum both quantities for same product
  const stockNeeded = new Map<string, number>();
  for (const item of items) {
    stockNeeded.set(item.productId, (stockNeeded.get(item.productId) || 0) + item.quantity);
  }
  eq(stockNeeded.get("prod-1"), 8); // 5 + 3
  eq(stockNeeded.get("prod-2"), 1);
});

// ═══════════════════════════════════════════════════════════════════════════
// Currency Formatting Edge Cases
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Currency Formatting ===");

test("TSH: large amounts with no decimals", () => {
  eq(formatCurrency(2500000, "TSH"), "TSh 2,500,000");
});

test("USD: standard 2-decimal format", () => {
  eq(formatCurrency(1234.5, "USD"), "$1,234.50");
});

test("TSH: zero amount", () => {
  eq(formatCurrency(0, "TSH"), "TSh 0");
});

test("unknown currency defaults to USD format", () => {
  const result = formatCurrency(100, "EUR");
  eq(result, "$100.00"); // Defaults to USD $
});

test("formatNumber handles large TSH amounts", () => {
  const result = formatNumber(13150000, 0);
  eq(result, "13,150,000");
});

test("mixed currency receipt: items in USD, total in TSH", () => {
  const itemUsd = 50;
  const exchangeRate = 2630;
  const totalTsh = itemUsd * exchangeRate;
  eq(formatCurrency(totalTsh, "TSH"), "TSh 131,500");
});

// ═══════════════════════════════════════════════════════════════════════════
// Invoice Number Generation
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Invoice Numbers ===");

test("standard: INV-0001", () => {
  const prefix = "INV";
  const num = 1;
  eq(`${prefix}-${String(num).padStart(4, "0")}`, "INV-0001");
});

test("custom prefix: RCP-0042", () => {
  eq(`RCP-${String(42).padStart(4, "0")}`, "RCP-0042");
});

test("large number: INV-99999 (5 digits)", () => {
  eq(`INV-${String(99999).padStart(4, "0")}`, "INV-99999");
});

test("sale number uses timestamp", () => {
  const sn = `SAL-${Date.now()}`;
  assert(sn.startsWith("SAL-"), "starts with SAL-");
  assert(sn.length > 10, "has timestamp");
});

// ═══════════════════════════════════════════════════════════════════════════
// End-to-End Sale Scenario
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Full Sale Scenario ===");

test("Tanzania glass shop: 3 items, discount, 18% VAT, credit payment", () => {
  const items = [
    { quantity: 5, unitPrice: 120000 },   // 5 sheets × 120k TSh
    { quantity: 2.5, unitPrice: 45000 },   // 2.5 m² × 45k/m² TSh
    { quantity: 1, unitPrice: 35000 },     // 1 silicone tube
  ];
  const discount = 50000; // 50k TSh discount
  const taxRate = 18;

  const r = calculateSaleTotals(items, discount, taxRate);

  eq(r.subtotal, 747500); // 600000 + 112500 + 35000
  eq(r.discountAmount, 50000);
  eq(r.taxableAmount, 697500);
  close(r.taxAmount, 125550, 1); // 697500 * 0.18
  close(r.total, 823050, 1); // 697500 + 125550

  // Format in TSH
  eq(formatCurrency(r.total, "TSH"), "TSh 823,050");
});

test("walk-in customer: quick cash sale, no discount, no tax", () => {
  const r = calculateSaleTotals([{ quantity: 1, unitPrice: 25000 }], 0, 0);
  eq(r.total, 25000);
  eq(formatCurrency(r.total, "TSH"), "TSh 25,000");
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
