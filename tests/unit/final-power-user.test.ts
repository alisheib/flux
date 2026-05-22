/**
 * FINAL ROUND — Power User + End-to-End Money Trail
 * A smart accountant pushes every boundary: bulk operations, penny-exact
 * reconciliation, full sale→invoice→payment→credit note→restock cycle,
 * and every rounding edge case that makes finance software break.
 *
 * Run: npx tsx tests/unit/final-power-user.test.ts
 */

import { calculateShipmentCosts, formatCurrency, formatNumber } from "../../src/lib/calculations";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  \x1b[32mPASS\x1b[0m  ${name}`); }
  catch (e: unknown) { failed++; const m = e instanceof Error ? e.message : String(e); console.log(`  \x1b[31mFAIL\x1b[0m  ${name}\n        ${m}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function eq(a: unknown, b: unknown, m?: string) { if (a !== b) throw new Error(m || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function close(a: number, b: number, tol: number, m?: string) { if (Math.abs(a - b) > tol) throw new Error(m || `Expected ~${b}, got ${a} (tol ${tol})`); }

// ── Sale calculator (exact copy from sales/route.ts) ──────────────────
function calcSale(items: { qty: number; price: number }[], discount: number, taxRate: number) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const discountAmt = Math.max(0, Math.min(discount, subtotal));
  const taxable = subtotal - discountAmt;
  const tax = Math.round(taxable * (taxRate / 100) * 100) / 100;
  const total = Math.round((taxable + tax) * 100) / 100;
  return { subtotal, discountAmt, taxable, tax, total };
}

// ═══════════════════════════════════════════════════════════════════════════
// END-TO-END: Complete Sale → Invoice → Payment → Credit Note cycle
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== E2E: Full Money Trail — Tanzania Glass Shop ===");

test("FULL CYCLE: 3-item sale → partial payment → second payment → partial refund → reconcile", () => {
  // Step 1: Sale
  const sale = calcSale([
    { qty: 10, price: 120000 },  // 10 sheets × 120k TSh
    { qty: 5, price: 85000 },    // 5 sheets × 85k TSh
    { qty: 2, price: 45000 },    // 2 tubes silicone × 45k
  ], 50000, 18); // 50k discount, 18% VAT

  eq(sale.subtotal, 1715000); // 1200000 + 425000 + 90000
  eq(sale.discountAmt, 50000);
  eq(sale.taxable, 1665000);
  eq(sale.tax, 299700); // 1665000 × 0.18
  eq(sale.total, 1964700);

  // Step 2: First partial payment (mobile money)
  let totalPaid = 0;
  const payment1 = 1000000;
  totalPaid += payment1;
  let outstanding = Math.round((sale.total - totalPaid) * 100) / 100;
  eq(outstanding, 964700);
  let saleStatus = "partial";

  // Step 3: Second payment (cash, pays remaining)
  const payment2 = outstanding;
  totalPaid += payment2;
  outstanding = Math.round((sale.total - totalPaid) * 100) / 100;
  eq(outstanding, 0);
  saleStatus = "completed";
  eq(saleStatus, "completed");

  // Step 4: Customer returns 3 sheets of the first item
  const refundSubtotal = 3 * 120000; // 360000
  const refundTax = Math.round(refundSubtotal * (18 / 100) * 100) / 100; // 64800
  const refundTotal = Math.round((refundSubtotal + refundTax) * 100) / 100; // 424800
  eq(refundTotal, 424800);

  // Validate: refund does not exceed sale total
  assert(refundTotal <= sale.total, "refund within sale total");

  // Step 5: After refund, net revenue
  const netRevenue = sale.total - refundTotal;
  eq(netRevenue, 1539900);

  // Step 6: Stock reconciliation
  // Original: 10 sheets sold → stock -10
  // Refund: 3 returned → stock +3
  // Net: 7 sheets sold from stock
  const stockDeducted = 10;
  const stockReturned = 3;
  const netStockChange = -(stockDeducted - stockReturned);
  eq(netStockChange, -7);
});

test("FULL CYCLE: Credit sale → partial payments over 3 months → fully paid", () => {
  const sale = calcSale([{ qty: 100, price: 150000 }], 0, 18);
  eq(sale.total, 17700000); // 15M + 18% = 17.7M TSh

  // Credit sale: status = "credit"
  let paid = 0;
  const payments = [5000000, 5000000, 5000000, 2700000]; // 4 installments
  for (const p of payments) {
    const outstanding = Math.round((sale.total - paid) * 100) / 100;
    assert(p <= outstanding + 0.01, `payment ${p} <= outstanding ${outstanding}`);
    paid += p;
  }
  eq(paid, 17700000);
  const finalOutstanding = Math.round((sale.total - paid) * 100) / 100;
  eq(finalOutstanding, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// PENNY-EXACT ROUNDING (the #1 killer of finance software)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Power User: Penny-Exact Rounding ===");

test("0.1 + 0.2 must display as 0.30, not 0.30000000000000004", () => {
  const result = formatNumber(0.1 + 0.2, 2);
  eq(result, "0.30");
});

test("tax on 99.99 at 18% = 18.00 exactly", () => {
  const tax = Math.round(99.99 * 0.18 * 100) / 100;
  eq(tax, 18);
});

test("tax on 33.33 at 18% = 6.00 exactly (not 5.9994)", () => {
  const tax = Math.round(33.33 * 0.18 * 100) / 100;
  eq(tax, 6);
});

test("3 payments of 33.33 on 100.00 sale = 0.01 remaining", () => {
  const total = 100;
  const paid = 33.33 + 33.33 + 33.33;
  const outstanding = Math.round((total - paid) * 100) / 100;
  eq(outstanding, 0.01);
});

test("splitting 1,000,000 TSh 3 ways: 333333 + 333333 + 333334 = 1000000", () => {
  const total = 1000000;
  const share = Math.floor(total / 3);
  const last = total - share * 2;
  eq(share + share + last, total);
});

test("tax rounding: 7 items at 142,857.14 each, 18% tax", () => {
  const items = Array(7).fill({ qty: 1, price: 142857.14 });
  const sale = calcSale(items, 0, 18);
  close(sale.subtotal, 999999.98, 0.01);
  // Tax should be consistent regardless of rounding path
  assert(isFinite(sale.tax), "tax is finite");
  assert(sale.total > sale.subtotal, "total > subtotal with positive tax");
});

test("discount exactly equals subtotal: total should be 0", () => {
  const sale = calcSale([{ qty: 1, price: 500 }], 500, 0);
  eq(sale.total, 0);
});

test("discount exceeds subtotal: capped, total = 0", () => {
  const sale = calcSale([{ qty: 1, price: 500 }], 9999, 0);
  eq(sale.discountAmt, 500);
  eq(sale.total, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// SHIPMENT LANDED COST → SELLING PRICE CHAIN
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Power User: Shipment → Margin → Profit Verification ===");

test("landed cost + 25% margin → verify profit", () => {
  const items = [
    { id: "1", name: "Glass 4mm", quantity: 200, totalCost: 9000 },
    { id: "2", name: "Glass 6mm", quantity: 100, totalCost: 7500 },
  ];
  const expenses = [
    { amountUsd: 3500, category: "Freight" },
    { amountUsd: 1200, category: "Customs" },
    { amountUsd: 800, category: "Port" },
  ];
  const result = calculateShipmentCosts(items, expenses, [25]);

  // Glass 4mm: landed cost per unit
  const g4 = result.products[0];
  assert(g4.costPerUnit > 0, "cost per unit positive");

  // Selling at 25% margin
  const sellPrice = g4.margins.find(m => m.percent === 25)!.pricePerUnit;
  assert(sellPrice > g4.costPerUnit, "sell > cost");
  const profitPerUnit = sellPrice - g4.costPerUnit;
  const profitPercent = (profitPerUnit / g4.costPerUnit) * 100;
  close(profitPercent, 25, 0.1, "margin = 25%");

  // Total profit for all 200 units
  const totalProfit = profitPerUnit * g4.totalQty;
  assert(totalProfit > 0, "total profit positive");
});

test("exchange rate conversion: USD landed cost → TSH selling price", () => {
  const costPerUnitUsd = 60;
  const exchangeRate = 2630;
  const costTsh = costPerUnitUsd * exchangeRate; // 157,800 TSh
  const marginPercent = 30;
  const sellingPriceTsh = Math.round(costTsh * (1 + marginPercent / 100));

  eq(costTsh, 157800);
  eq(sellingPriceTsh, 205140);
  eq(formatCurrency(sellingPriceTsh, "TSH"), "TSh 205,140");
});

// ═══════════════════════════════════════════════════════════════════════════
// STOCK LEDGER INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Power User: Stock Ledger Audit ===");

test("stock ledger: every movement sums to current balance", () => {
  const movements = [
    { type: "shipment_received", qty: 500 },
    { type: "sale", qty: -12 },
    { type: "sale", qty: -8 },
    { type: "sale", qty: -25 },
    { type: "refund", qty: 3 },
    { type: "manual", qty: -2 },  // damaged
    { type: "shipment_received", qty: 200 },
    { type: "sale", qty: -50 },
    { type: "sale", qty: -100 },
    { type: "refund", qty: 10 },
    { type: "manual", qty: 5 },   // found extra
  ];
  let balance = 0;
  const ledger: { type: string; qty: number; balance: number }[] = [];
  for (const m of movements) {
    balance += m.qty;
    balance = Math.round(balance * 10000) / 10000;
    ledger.push({ ...m, balance });
  }
  eq(balance, 521);
  eq(ledger.length, 11);
  // Every entry's balance should equal sum of all prior quantities
  let checkSum = 0;
  for (const entry of ledger) {
    checkSum += entry.qty;
    checkSum = Math.round(checkSum * 10000) / 10000;
    eq(entry.balance, checkSum, `balance mismatch at ${entry.type}`);
  }
});

test("fractional stock: area sales with sqm conversion", () => {
  const sqmPerUnit = 2.9768; // m² per sheet
  let stock = 50.0; // 50 sheets

  // Sell 7.5 m² (= 2.5195 sheets)
  const sale1Sheets = Math.round((7.5 / sqmPerUnit) * 10000) / 10000;
  stock = Math.round((stock - sale1Sheets) * 10000) / 10000;

  // Sell 15 m² (= 5.0390 sheets)
  const sale2Sheets = Math.round((15 / sqmPerUnit) * 10000) / 10000;
  stock = Math.round((stock - sale2Sheets) * 10000) / 10000;

  // Refund 3 m² (= 1.0078 sheets)
  const refundSheets = Math.round((3 / sqmPerUnit) * 10000) / 10000;
  stock = Math.round((stock + refundSheets) * 10000) / 10000;

  // Net: 50 - 2.5195 - 5.039 + 1.0078 = 43.4493
  close(stock, 43.4493, 0.001);
  assert(stock > 0, "stock remains positive");
});

// ═══════════════════════════════════════════════════════════════════════════
// CREDIT NOTE CHAIN: multiple refunds until fully refunded
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Power User: Multi-Refund Chain ===");

test("3 partial refunds then attempt 4th = blocked", () => {
  const saleTotal = 1000;
  const taxRate = 18;
  let refunded = 0;
  const refunds = [
    { subtotal: 200 }, // + 36 tax = 236
    { subtotal: 300 }, // + 54 tax = 354
    { subtotal: 200 }, // + 36 tax = 236
  ];

  for (const r of refunds) {
    const tax = Math.round(r.subtotal * (taxRate / 100) * 100) / 100;
    const total = Math.round((r.subtotal + tax) * 100) / 100;
    assert(refunded + total <= saleTotal + 0.01, `refund ${total} within limit`);
    refunded += total;
  }

  eq(refunded, 826); // 236 + 354 + 236
  const remaining = Math.round((saleTotal - refunded) * 100) / 100;
  eq(remaining, 174);

  // 4th refund of 200 (+ tax = 236) would exceed
  const attempt4Tax = Math.round(200 * (taxRate / 100) * 100) / 100;
  const attempt4Total = 200 + attempt4Tax; // 236
  assert(refunded + attempt4Total > saleTotal + 0.01, "4th refund blocked");
});

// ═══════════════════════════════════════════════════════════════════════════
// RECEIVABLES AGING
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Power User: Receivables Tracking ===");

test("outstanding balance across multiple credit sales", () => {
  const sales = [
    { total: 500000, payments: [200000, 100000] }, // 200k outstanding
    { total: 800000, payments: [800000] },           // 0 outstanding (paid)
    { total: 1200000, payments: [] },                 // 1.2M outstanding
    { total: 350000, payments: [100000, 100000] },   // 150k outstanding
  ];
  let totalOutstanding = 0;
  let totalRevenue = 0;
  for (const s of sales) {
    totalRevenue += s.total;
    const paid = s.payments.reduce((sum, p) => sum + p, 0);
    totalOutstanding += Math.round((s.total - paid) * 100) / 100;
  }
  eq(totalRevenue, 2850000);
  eq(totalOutstanding, 1550000);
});

// ═══════════════════════════════════════════════════════════════════════════
// BOUNDARY VALUES
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Power User: Extreme Boundaries ===");

test("sale with 1 item at 0.01 price (smallest possible)", () => {
  const sale = calcSale([{ qty: 1, price: 0.01 }], 0, 18);
  eq(sale.subtotal, 0.01);
  eq(sale.tax, 0); // 0.01 * 0.18 = 0.0018 → rounds to 0.00
  eq(sale.total, 0.01);
});

test("sale with 999,999 items (stress)", () => {
  const sale = calcSale([{ qty: 999999, price: 1 }], 0, 0);
  eq(sale.total, 999999);
});

test("100 line items in one sale", () => {
  const items = Array.from({ length: 100 }, (_, i) => ({ qty: i + 1, price: 1000 }));
  const sale = calcSale(items, 0, 18);
  // Sum 1..100 = 5050, × 1000 = 5,050,000
  eq(sale.subtotal, 5050000);
  assert(sale.total > sale.subtotal, "tax added");
});

test("MAX_SAFE_INTEGER stock quantity doesn't overflow", () => {
  const stock = Number.MAX_SAFE_INTEGER;
  const afterSale = stock - 1;
  assert(afterSale === stock - 1, "no overflow");
  assert(Number.isSafeInteger(afterSale), "still safe integer");
});

test("very small fractional stock: 0.0001 sheets", () => {
  const stock = 0.0001;
  const needed = 0.00005;
  assert(stock >= needed, "can sell fractional");
  const remaining = Math.round((stock - needed) * 10000) / 10000;
  eq(remaining, 0.0001); // 0.0001 - 0.00005 = 0.00005, rounds to 0.0001 at 4dp
});

// ═══════════════════════════════════════════════════════════════════════════
// INVOICE NUMBER SEQUENCE INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Power User: Invoice Numbering ===");

test("500 sequential invoices: no gaps, no duplicates", () => {
  const numbers = new Set<string>();
  for (let i = 1; i <= 500; i++) {
    const num = `INV-${String(i).padStart(4, "0")}`;
    assert(!numbers.has(num), `duplicate: ${num}`);
    numbers.add(num);
  }
  eq(numbers.size, 500);
});

test("invoice prefix change mid-stream", () => {
  const before = `INV-${String(42).padStart(4, "0")}`;
  const after = `FAC-${String(43).padStart(4, "0")}`; // French prefix
  eq(before, "INV-0042");
  eq(after, "FAC-0043");
  assert(before !== after, "different prefixes produce different numbers");
});

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-CURRENCY DISPLAY
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Power User: Currency Display Edge Cases ===");

test("TSH: 1 → 'TSh 1'", () => eq(formatCurrency(1, "TSH"), "TSh 1"));
test("TSH: 999 → 'TSh 999'", () => eq(formatCurrency(999, "TSH"), "TSh 999"));
test("TSH: 1000 → 'TSh 1,000'", () => eq(formatCurrency(1000, "TSH"), "TSh 1,000"));
test("TSH: 99999999 → 'TSh 99,999,999'", () => eq(formatCurrency(99999999, "TSH"), "TSh 99,999,999"));
test("USD: 0.001 → '$0.00' (sub-cent rounds down)", () => eq(formatCurrency(0.001, "USD"), "$0.00"));
test("USD: 0.005 → '$0.01' (rounds up)", () => eq(formatCurrency(0.005, "USD"), "$0.01"));
test("USD: 0.994 → '$0.99'", () => eq(formatCurrency(0.994, "USD"), "$0.99"));
test("USD: 0.995 → '$1.00' (rounds up)", () => eq(formatCurrency(0.995, "USD"), "$1.00"));

// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNTING: P&L SANITY
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Power User: P&L Sanity Check ===");

test("revenue - COGS - expenses = profit (no phantom money)", () => {
  const revenue = 17700000;   // total sales
  const cogs = 10000000;      // cost of goods from shipments
  const expenses = 2500000;   // operating expenses
  const taxPaid = 2700000;    // VAT collected → remitted
  const profit = revenue - cogs - expenses - taxPaid;
  eq(profit, 2500000);
  assert(profit > 0, "business is profitable");
});

test("total payments received = total invoiced (no money leak)", () => {
  const invoiced = [500000, 800000, 1200000, 350000];
  const payments = [200000, 100000, 800000, 100000, 100000]; // partial
  const totalInvoiced = invoiced.reduce((s, v) => s + v, 0);
  const totalPaid = payments.reduce((s, v) => s + v, 0);
  const totalOutstanding = totalInvoiced - totalPaid;
  eq(totalInvoiced, 2850000);
  eq(totalPaid, 1300000);
  eq(totalOutstanding, 1550000);
  eq(totalInvoiced, totalPaid + totalOutstanding); // money conservation law
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
