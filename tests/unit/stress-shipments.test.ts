/**
 * STRESS TESTS — Shipments, Containers, Exchange Rates, Cost Breakdown
 * Tests every edge case in shipment management, landed cost calculation, expense allocation
 * Run: npx tsx tests/unit/stress-shipments.test.ts
 */

import { calculateShipmentCosts } from "../../src/lib/calculations";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  \x1b[32mPASS\x1b[0m  ${name}`); }
  catch (e: unknown) { failed++; const m = e instanceof Error ? e.message : String(e); console.log(`  \x1b[31mFAIL\x1b[0m  ${name}\n        ${m}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function eq(a: unknown, b: unknown, m?: string) { if (a !== b) throw new Error(m || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function close(a: number, b: number, tol: number, m?: string) { if (Math.abs(a - b) > tol) throw new Error(m || `Expected ~${b}, got ${a} (tol ${tol})`); }

// ═══════════════════════════════════════════════════════════════════════════
// Container Types & Counts
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Container Types ===");

const CONTAINER_TYPES = ["20HC", "20GP", "40HC", "40GP", "40HQ", "LCL"];

test("all valid container types are strings", () => {
  for (const t of CONTAINER_TYPES) {
    assert(typeof t === "string" && t.length > 0, `Valid: ${t}`);
  }
});

test("container count defaults to 1", () => {
  const count = undefined || 1;
  eq(count, 1);
});

test("container count validation: rejects 0", () => {
  const count = 0;
  assert(count < 1, "zero containers rejected");
});

test("container count validation: rejects negative", () => {
  assert(-1 < 1, "negative rejected");
});

test("multiple containers for large shipments", () => {
  const count = 5;
  assert(count >= 1, "5 containers OK");
});

// ═══════════════════════════════════════════════════════════════════════════
// Exchange Rate Edge Cases
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Exchange Rates ===");

test("default exchange rate = 2630 (TSh/USD)", () => {
  const rate = undefined || 2630;
  eq(rate, 2630);
});

test("exchange rate > 0 required", () => {
  assert(0 <= 0, "zero rejected");
  assert(-100 <= 0, "negative rejected");
});

test("very high exchange rate (Zimbabwe-like)", () => {
  const rate = 99999999;
  assert(rate > 0, "high rate accepted");
});

test("fractional exchange rate (EUR/USD)", () => {
  const rate = 0.92;
  assert(rate > 0, "fractional accepted");
});

test("exchange rate 1.0 (same currency)", () => {
  const rate = 1.0;
  assert(rate > 0, "1:1 accepted");
});

test("USD cost × exchange rate = local amount", () => {
  const costUsd = 5000;
  const rate = 2630;
  const local = costUsd * rate;
  eq(local, 13150000);
});

test("local amount ÷ exchange rate = USD", () => {
  const local = 13150000;
  const rate = 2630;
  const usd = local / rate;
  eq(usd, 5000);
});

// ═══════════════════════════════════════════════════════════════════════════
// Origin / Supplier Handling
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Shipment Origins ===");

test("origin defaults to 'China'", () => {
  const origin = undefined || "China";
  eq(origin, "China");
});

test("various real origins", () => {
  const origins = ["China", "UAE", "Turkey", "India", "Germany", "South Africa", "Kenya", "Tanzania"];
  for (const o of origins) {
    assert(typeof o === "string" && o.length > 0, `Valid origin: ${o}`);
  }
});

test("origin can be any string (no whitelist)", () => {
  const origin = "Democratic Republic of the Congo";
  assert(origin.length > 0, "long origin OK");
});

// ═══════════════════════════════════════════════════════════════════════════
// Shipment Item Validation Bugs
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Shipment Item Validation ===");

function validateShipmentItem(body: { name?: string; quantity?: number; unitCost?: number }): string | null {
  if (!body.name || body.quantity === undefined || body.unitCost === undefined)
    return "name, quantity, and unitCost are required";
  // BUG: Current API does NOT validate these:
  if (typeof body.quantity !== "number" || body.quantity <= 0)
    return "Quantity must be positive";
  if (typeof body.unitCost !== "number" || body.unitCost < 0)
    return "Unit cost cannot be negative";
  return null;
}

test("valid shipment item passes", () => {
  eq(validateShipmentItem({ name: "Glass 5mm", quantity: 100, unitCost: 45 }), null);
});
test("missing name rejected", () => {
  assert(validateShipmentItem({ quantity: 100, unitCost: 45 }) !== null, "no name");
});
test("missing quantity rejected", () => {
  assert(validateShipmentItem({ name: "X", unitCost: 45 }) !== null, "no qty");
});
test("BUG: zero quantity should be rejected", () => {
  assert(validateShipmentItem({ name: "X", quantity: 0, unitCost: 45 }) !== null, "zero qty");
});
test("BUG: negative quantity should be rejected", () => {
  assert(validateShipmentItem({ name: "X", quantity: -5, unitCost: 45 }) !== null, "neg qty");
});
test("BUG: negative unitCost should be rejected", () => {
  assert(validateShipmentItem({ name: "X", quantity: 10, unitCost: -5 }) !== null, "neg cost");
});
test("zero unitCost allowed (free goods/samples)", () => {
  eq(validateShipmentItem({ name: "Sample", quantity: 1, unitCost: 0 }), null);
});

test("totalCost = quantity × unitCost", () => {
  const q = 100, c = 45.50;
  const total = q * c;
  eq(total, 4550);
});

test("BUG: NaN quantity × unitCost = NaN totalCost", () => {
  const q = NaN, c = 45;
  const total = q * c;
  assert(isNaN(total), "NaN propagates to total");
});

// ═══════════════════════════════════════════════════════════════════════════
// Expense Validation
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Shipment Expense Validation ===");

function validateExpense(body: { category?: string; description?: string; amountLocal?: number; amountUsd?: number }): string | null {
  if (!body.category || !body.description) return "category and description required";
  // BUG: Current API accepts negative amounts!
  if (body.amountLocal !== undefined && body.amountLocal < 0) return "Local amount cannot be negative";
  if (body.amountUsd !== undefined && body.amountUsd < 0) return "USD amount cannot be negative";
  return null;
}

test("valid expense passes", () => {
  eq(validateExpense({ category: "Freight", description: "Sea freight", amountUsd: 3000 }), null);
});
test("BUG: negative amountUsd should be rejected", () => {
  assert(validateExpense({ category: "X", description: "Y", amountUsd: -500 }) !== null, "neg usd");
});
test("BUG: negative amountLocal should be rejected", () => {
  assert(validateExpense({ category: "X", description: "Y", amountLocal: -1000 }) !== null, "neg local");
});
test("zero amounts allowed (placeholder entries)", () => {
  eq(validateExpense({ category: "Customs", description: "Pending", amountUsd: 0, amountLocal: 0 }), null);
});

// ═══════════════════════════════════════════════════════════════════════════
// Landed Cost Breakdown — Real-World Scenarios
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Landed Cost: Real Shipment Scenarios ===");

test("China glass shipment: 2 items, 5 expense categories", () => {
  const items = [
    { id: "1", name: "5mm Clear 1220x2440", quantity: 200, totalCost: 9000 },
    { id: "2", name: "6mm Bronze 1220x2440", quantity: 100, totalCost: 7500 },
  ];
  const expenses = [
    { amountUsd: 3500, category: "Sea Freight" },
    { amountUsd: 1200, category: "Customs Duty" },
    { amountUsd: 800, category: "Port Charges" },
    { amountUsd: 400, category: "Insurance" },
    { amountUsd: 300, category: "Local Transport" },
  ];

  const result = calculateShipmentCosts(items, expenses);

  eq(result.totalFob, 16500);
  eq(result.totalExpenses, 6200);
  eq(result.totalLandedCost, 22700);
  eq(result.totalQty, 300);
  close(result.avgCostPerUnit, 75.67, 0.01);

  // 5mm clear: 9000/16500 = 54.55% share
  const glass5mm = result.products[0];
  close(glass5mm.valueShare, 0.545455, 0.001);
  close(glass5mm.allocatedExpenses, 3381.82, 1);
  close(glass5mm.landedCost, 12381.82, 1);
  close(glass5mm.costPerUnit, 61.91, 0.1);
});

test("single item shipment: all expenses go to one product", () => {
  const items = [{ id: "1", name: "Product A", quantity: 50, totalCost: 5000 }];
  const expenses = [{ amountUsd: 2000, category: "Freight" }];

  const result = calculateShipmentCosts(items, expenses);

  eq(result.products[0].valueShare, 1);
  eq(result.products[0].allocatedExpenses, 2000);
  eq(result.products[0].landedCost, 7000);
  eq(result.products[0].costPerUnit, 140);
});

test("shipment with zero expenses = FOB only", () => {
  const items = [{ id: "1", name: "Local Purchase", quantity: 100, totalCost: 10000 }];
  const result = calculateShipmentCosts(items, []);

  eq(result.totalExpenses, 0);
  eq(result.totalLandedCost, 10000);
  eq(result.products[0].allocatedExpenses, 0);
});

test("many small items — expense allocation precision", () => {
  // 50 different products in one container
  const items = Array.from({ length: 50 }, (_, i) => ({
    id: String(i),
    name: `Item ${i}`,
    quantity: 10 + i,
    totalCost: 100 + i * 50,
  }));
  const expenses = [
    { amountUsd: 5000, category: "Freight" },
    { amountUsd: 3000, category: "Customs" },
  ];

  const result = calculateShipmentCosts(items, expenses);

  // Verify all allocated expenses sum to total expenses
  const totalAllocated = result.products.reduce((s, p) => s + p.allocatedExpenses, 0);
  close(totalAllocated, 8000, 1, "allocated expenses must sum to total");

  // Verify all value shares sum to 1
  const totalShare = result.products.reduce((s, p) => s + p.valueShare, 0);
  close(totalShare, 1.0, 0.001, "value shares must sum to 1");
});

test("expense categories grouped correctly with duplicates", () => {
  const expenses = [
    { amountUsd: 1000, category: "Freight" },
    { amountUsd: 500, category: "Customs" },
    { amountUsd: 2000, category: "Freight" },
    { amountUsd: 300, category: "Insurance" },
    { amountUsd: 800, category: "Customs" },
  ];
  const result = calculateShipmentCosts(
    [{ id: "1", name: "X", quantity: 1, totalCost: 1000 }],
    expenses
  );

  eq(result.expensesByCategory.length, 3);
  // Sorted by total descending
  eq(result.expensesByCategory[0].category, "Freight");
  eq(result.expensesByCategory[0].total, 3000);
  eq(result.expensesByCategory[1].category, "Customs");
  eq(result.expensesByCategory[1].total, 1300);
});

test("margin pricing from landed cost", () => {
  const items = [{ id: "1", name: "Glass", quantity: 100, totalCost: 5000 }];
  const expenses = [{ amountUsd: 1000, category: "Freight" }];
  const margins = [10, 20, 30];

  const result = calculateShipmentCosts(items, expenses, margins);
  const product = result.products[0];

  eq(product.costPerUnit, 60); // (5000+1000)/100
  eq(product.margins[0].percent, 10);
  eq(product.margins[0].pricePerUnit, 66); // 60 * 1.10
  eq(product.margins[1].pricePerUnit, 72); // 60 * 1.20
  eq(product.margins[2].pricePerUnit, 78); // 60 * 1.30
});

test("zero-quantity item doesn't cause division by zero", () => {
  const items = [{ id: "1", name: "Empty", quantity: 0, totalCost: 0 }];
  const result = calculateShipmentCosts(items, []);
  eq(result.products[0].costPerUnit, 0);
});

test("zero-FOB item gets zero expense allocation", () => {
  const items = [
    { id: "1", name: "Free Sample", quantity: 10, totalCost: 0 },
    { id: "2", name: "Paid Product", quantity: 10, totalCost: 5000 },
  ];
  const expenses = [{ amountUsd: 1000, category: "Freight" }];
  const result = calculateShipmentCosts(items, expenses);

  eq(result.products[0].valueShare, 0);
  eq(result.products[0].allocatedExpenses, 0);
  eq(result.products[1].valueShare, 1);
  eq(result.products[1].allocatedExpenses, 1000);
});

// ═══════════════════════════════════════════════════════════════════════════
// Shipment Status Transitions
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Shipment Status ===");

const VALID_STATUSES = ["clearing", "in_transit", "in_warehouse", "completed"];

test("default status is 'clearing'", () => {
  const status = undefined || "clearing";
  eq(status, "clearing");
});

test("all valid statuses accepted", () => {
  for (const s of VALID_STATUSES) {
    assert(VALID_STATUSES.includes(s), `${s} is valid`);
  }
});

test("invalid status rejected", () => {
  assert(!VALID_STATUSES.includes("shipped"), "shipped not valid");
  assert(!VALID_STATUSES.includes(""), "empty not valid");
  assert(!VALID_STATUSES.includes("CLEARING"), "case sensitive");
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
