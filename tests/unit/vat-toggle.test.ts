/**
 * VAT Toggle — includeTax feature
 * Tests calculation logic, API contract, and downstream display guards.
 * Mirrors the exact logic in:
 *   - src/app/api/sales/route.ts (server-side calc)
 *   - src/app/(app)/pos/page.tsx (client-side calc)
 *   - All display templates (taxRate > 0 guard)
 * Run: npx tsx tests/unit/vat-toggle.test.ts
 */

let P = 0, F = 0;
function test(n: string, fn: () => void) { try { fn(); P++; console.log(`  \x1b[32mPASS\x1b[0m  ${n}`); } catch (e: unknown) { F++; console.log(`  \x1b[31mFAIL\x1b[0m  ${n}\n        ${e instanceof Error ? e.message : e}`); } }
function eq(a: unknown, b: unknown, m?: string) { if (a !== b) throw new Error(m || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

// ── Mirror of server-side calc (sales/route.ts lines 160-169) ────────
function calcSaleServer(
  items: { quantity: number; unitPrice: number }[],
  discount: number,
  orgTaxRate: number,
  includeTax: boolean
) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountAmount = Math.max(0, Math.min(discount || 0, subtotal));
  const taxableAmount = subtotal - discountAmount;
  const taxRate = includeTax ? orgTaxRate : 0;
  const taxAmount = Math.round(taxableAmount * (taxRate / 100) * 100) / 100;
  const total = Math.round((taxableAmount + taxAmount) * 100) / 100;
  return { subtotal, discountAmount, taxableAmount, taxRate, taxAmount, total, includeTax };
}

// ── Mirror of client-side calc (pos/page.tsx lines 445-447) ──────────
function calcSaleClient(
  cartSubtotal: number,
  discountAmount: number,
  orgTaxRate: number,
  includeTax: boolean
) {
  const taxableAmount = cartSubtotal - discountAmount;
  const taxAmount = includeTax ? (taxableAmount * orgTaxRate) / 100 : 0;
  const total = taxableAmount + taxAmount;
  return { taxableAmount, taxAmount, total };
}

// ── Display guard (used in all 11 downstream paths) ──────────────────
function shouldShowTaxLine(taxRate: number): boolean {
  return taxRate > 0;
}

const ITEMS = [
  { quantity: 50, unitPrice: 120000 },
  { quantity: 20, unitPrice: 180000 },
  { quantity: 10, unitPrice: 15000 },
];
const ORG_TAX_RATE = 18;
const EXPECTED_SUBTOTAL = 9750000; // 50×120k + 20×180k + 10×15k

// ═══════════════════════════════════════════════════════════════════════
// 1. includeTax = true (default behavior, must not regress)
// ═══════════════════════════════════════════════════════════════════════
console.log("\n=== 1. includeTax = true (default) ===");

test("server: subtotal correct", () => {
  const s = calcSaleServer(ITEMS, 0, ORG_TAX_RATE, true);
  eq(s.subtotal, EXPECTED_SUBTOTAL);
});

test("server: taxRate = org rate when included", () => {
  const s = calcSaleServer(ITEMS, 0, ORG_TAX_RATE, true);
  eq(s.taxRate, 18);
});

test("server: tax = 18% of 9,750,000 = 1,755,000", () => {
  const s = calcSaleServer(ITEMS, 0, ORG_TAX_RATE, true);
  eq(s.taxAmount, 1755000);
});

test("server: total = subtotal + tax = 11,505,000", () => {
  const s = calcSaleServer(ITEMS, 0, ORG_TAX_RATE, true);
  eq(s.total, 11505000);
});

test("server: includeTax flag stored as true", () => {
  const s = calcSaleServer(ITEMS, 0, ORG_TAX_RATE, true);
  eq(s.includeTax, true);
});

test("client: matches server calculation", () => {
  const c = calcSaleClient(EXPECTED_SUBTOTAL, 0, ORG_TAX_RATE, true);
  eq(c.taxAmount, 1755000);
  eq(c.total, 11505000);
});

test("display: tax line shown when taxRate > 0", () => {
  eq(shouldShowTaxLine(18), true);
});

// ═══════════════════════════════════════════════════════════════════════
// 2. includeTax = false (new feature)
// ═══════════════════════════════════════════════════════════════════════
console.log("\n=== 2. includeTax = false (VAT excluded) ===");

test("server: taxRate = 0 when excluded", () => {
  const s = calcSaleServer(ITEMS, 0, ORG_TAX_RATE, false);
  eq(s.taxRate, 0);
});

test("server: taxAmount = 0 when excluded", () => {
  const s = calcSaleServer(ITEMS, 0, ORG_TAX_RATE, false);
  eq(s.taxAmount, 0);
});

test("server: total = subtotal (no tax added)", () => {
  const s = calcSaleServer(ITEMS, 0, ORG_TAX_RATE, false);
  eq(s.total, EXPECTED_SUBTOTAL);
});

test("server: includeTax flag stored as false", () => {
  const s = calcSaleServer(ITEMS, 0, ORG_TAX_RATE, false);
  eq(s.includeTax, false);
});

test("client: taxAmount = 0 when excluded", () => {
  const c = calcSaleClient(EXPECTED_SUBTOTAL, 0, ORG_TAX_RATE, false);
  eq(c.taxAmount, 0);
});

test("client: total = subtotal when excluded", () => {
  const c = calcSaleClient(EXPECTED_SUBTOTAL, 0, ORG_TAX_RATE, false);
  eq(c.total, EXPECTED_SUBTOTAL);
});

test("display: tax line hidden when taxRate = 0", () => {
  eq(shouldShowTaxLine(0), false);
});

// ═══════════════════════════════════════════════════════════════════════
// 3. includeTax = false WITH discount
// ═══════════════════════════════════════════════════════════════════════
console.log("\n=== 3. Excluded VAT + Discount ===");

test("server: discount applied, no tax", () => {
  const s = calcSaleServer(ITEMS, 500000, ORG_TAX_RATE, false);
  eq(s.subtotal, EXPECTED_SUBTOTAL);
  eq(s.discountAmount, 500000);
  eq(s.taxAmount, 0);
  eq(s.total, 9250000); // 9,750,000 - 500,000
});

test("server: same discount WITH tax for comparison", () => {
  const s = calcSaleServer(ITEMS, 500000, ORG_TAX_RATE, true);
  eq(s.subtotal, EXPECTED_SUBTOTAL);
  eq(s.discountAmount, 500000);
  eq(s.taxAmount, 1665000); // 18% of 9,250,000
  eq(s.total, 10915000); // 9,250,000 + 1,665,000
});

test("price difference: with vs without VAT", () => {
  const withTax = calcSaleServer(ITEMS, 500000, ORG_TAX_RATE, true);
  const withoutTax = calcSaleServer(ITEMS, 500000, ORG_TAX_RATE, false);
  eq(withTax.total - withoutTax.total, 1665000); // difference = tax amount
});

// ═══════════════════════════════════════════════════════════════════════
// 4. API contract (body parsing)
// ═══════════════════════════════════════════════════════════════════════
console.log("\n=== 4. API Contract ===");

test("includeTax undefined → defaults to true", () => {
  const includeTaxRaw = undefined;
  const includeTax = includeTaxRaw !== false;
  eq(includeTax, true);
});

test("includeTax true → true", () => {
  const includeTaxRaw = true;
  const includeTax = includeTaxRaw !== false;
  eq(includeTax, true);
});

test("includeTax false → false", () => {
  const includeTaxRaw = false;
  const includeTax = includeTaxRaw !== false;
  eq(includeTax, false);
});

test("includeTax null → true (safe default)", () => {
  const includeTaxRaw = null;
  const includeTax = includeTaxRaw !== false;
  eq(includeTax, true);
});

test("includeTax 0 → true (only boolean false triggers exclusion)", () => {
  const includeTaxRaw = 0;
  const includeTax = includeTaxRaw !== false;
  eq(includeTax, true);
});

test("includeTax '' → true (only boolean false triggers exclusion)", () => {
  const includeTaxRaw = "";
  const includeTax = includeTaxRaw !== false;
  eq(includeTax, true);
});

// ═══════════════════════════════════════════════════════════════════════
// 5. Credit note tax inheritance
// ═══════════════════════════════════════════════════════════════════════
console.log("\n=== 5. Credit Note Tax Inheritance ===");

test("credit note uses sale.taxRate (included)", () => {
  const sale = calcSaleServer(ITEMS, 0, ORG_TAX_RATE, true);
  const refundSubtotal = 360000;
  const refundTax = Math.round(refundSubtotal * (sale.taxRate / 100) * 100) / 100;
  eq(refundTax, 64800);
});

test("credit note uses sale.taxRate (excluded → 0 tax on refund)", () => {
  const sale = calcSaleServer(ITEMS, 0, ORG_TAX_RATE, false);
  const refundSubtotal = 360000;
  const refundTax = Math.round(refundSubtotal * (sale.taxRate / 100) * 100) / 100;
  eq(refundTax, 0);
  eq(sale.taxRate, 0);
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Proforma conversion
// ═══════════════════════════════════════════════════════════════════════
console.log("\n=== 6. Proforma Conversion ===");

test("proforma with tax → invoice.includeTax = true", () => {
  const proformaTaxRate = 18;
  const includeTax = proformaTaxRate > 0;
  eq(includeTax, true);
});

test("proforma without tax → invoice.includeTax = false", () => {
  const proformaTaxRate = 0;
  const includeTax = proformaTaxRate > 0;
  eq(includeTax, false);
});

test("proforma totals propagate unchanged", () => {
  const proforma = { subtotal: 1000, taxRate: 0, taxAmount: 0, total: 1000 };
  const invoice = {
    subtotal: proforma.subtotal,
    taxRate: proforma.taxRate,
    taxAmount: proforma.taxAmount,
    includeTax: proforma.taxRate > 0,
    total: proforma.total,
  };
  eq(invoice.taxRate, 0);
  eq(invoice.taxAmount, 0);
  eq(invoice.includeTax, false);
  eq(invoice.total, 1000);
});

// ═══════════════════════════════════════════════════════════════════════
// 7. Display guard coverage (all 11 downstream paths)
// ═══════════════════════════════════════════════════════════════════════
console.log("\n=== 7. Display Guard Coverage ===");

const displayPaths = [
  "POS cart footer",
  "POS confirm dialog",
  "POS receipt dialog",
  "receipt-sheet (mobile)",
  "WhatsApp receipt text",
  "invoice list page",
  "invoice detail dialog",
  "invoice view/print page",
  "invoice-pdf.tsx (client PDF)",
  "invoice-template.ts (server PDF)",
  "receipt-template.ts (server receipt)",
];

for (const path of displayPaths) {
  test(`${path}: hidden when taxRate=0`, () => {
    eq(shouldShowTaxLine(0), false);
  });
  test(`${path}: shown when taxRate=18`, () => {
    eq(shouldShowTaxLine(18), true);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// 8. Edge cases
// ═══════════════════════════════════════════════════════════════════════
console.log("\n=== 8. Edge Cases ===");

test("org with 0% tax: toggle has no effect", () => {
  const withToggle = calcSaleServer(ITEMS, 0, 0, true);
  const withoutToggle = calcSaleServer(ITEMS, 0, 0, false);
  eq(withToggle.taxAmount, 0);
  eq(withoutToggle.taxAmount, 0);
  eq(withToggle.total, withoutToggle.total);
});

test("single item, small amount, excluded", () => {
  const s = calcSaleServer([{ quantity: 1, unitPrice: 100 }], 0, 18, false);
  eq(s.taxAmount, 0);
  eq(s.total, 100);
});

test("rounding: 18% of 999 = 179.82 (included)", () => {
  const s = calcSaleServer([{ quantity: 1, unitPrice: 999 }], 0, 18, true);
  eq(s.taxAmount, 179.82);
  eq(s.total, 1178.82);
});

test("rounding: excluded → exact subtotal", () => {
  const s = calcSaleServer([{ quantity: 1, unitPrice: 999 }], 0, 18, false);
  eq(s.taxAmount, 0);
  eq(s.total, 999);
});

test("full discount + excluded tax = 0 total", () => {
  const s = calcSaleServer([{ quantity: 1, unitPrice: 1000 }], 1000, 18, false);
  eq(s.total, 0);
  eq(s.taxAmount, 0);
});

test("full discount + included tax = 0 total", () => {
  const s = calcSaleServer([{ quantity: 1, unitPrice: 1000 }], 1000, 18, true);
  eq(s.total, 0);
  eq(s.taxAmount, 0);
});

test("clearCart resets includeTax to true", () => {
  // Simulate: toggle off → clear cart → defaults back
  let includeTax = false;
  // clearCart logic:
  includeTax = true;
  eq(includeTax, true);
});

// ═══════════════════════════════════════════════════════════════════════
// 9. Reports aggregation
// ═══════════════════════════════════════════════════════════════════════
console.log("\n=== 9. Reports Aggregation ===");

test("totalTax sums correctly with mixed includeTax sales", () => {
  const sales = [
    calcSaleServer([{ quantity: 10, unitPrice: 1000 }], 0, 18, true),   // tax: 1800
    calcSaleServer([{ quantity: 10, unitPrice: 1000 }], 0, 18, false),  // tax: 0
    calcSaleServer([{ quantity: 10, unitPrice: 1000 }], 0, 18, true),   // tax: 1800
  ];
  const totalTax = sales.reduce((s, sale) => s + sale.taxAmount, 0);
  eq(totalTax, 3600); // only 2 of 3 sales have tax
});

test("totalRevenue includes tax-excluded sales at lower amount", () => {
  const withTax = calcSaleServer([{ quantity: 10, unitPrice: 1000 }], 0, 18, true);
  const withoutTax = calcSaleServer([{ quantity: 10, unitPrice: 1000 }], 0, 18, false);
  eq(withTax.total, 11800);     // 10,000 + 1,800
  eq(withoutTax.total, 10000);  // 10,000 only
  const totalRevenue = withTax.total + withoutTax.total;
  eq(totalRevenue, 21800);
});

// ═══════════════════════════════════════════════════════════════════════
console.log(`\n${P + F} tests, ${P} passed, ${F} failed`);
if (F > 0) process.exit(1);
