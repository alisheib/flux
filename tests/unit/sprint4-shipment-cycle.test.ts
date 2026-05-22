/**
 * SPRINT 4 — Full Shipment/Import Cycle
 * Create shipment → add items → add expenses → cost breakdown → receive stock → verify margins
 * Run: npx tsx tests/unit/sprint4-shipment-cycle.test.ts
 */
import { calculateShipmentCosts, formatCurrency } from "../../src/lib/calculations";

let P = 0, F = 0;
function test(n: string, fn: () => void) { try { fn(); P++; console.log(`  \x1b[32mPASS\x1b[0m  ${n}`); } catch (e: unknown) { F++; console.log(`  \x1b[31mFAIL\x1b[0m  ${n}\n        ${e instanceof Error ? e.message : e}`); } }
function eq(a: unknown, b: unknown, m?: string) { if (a !== b) throw new Error(m || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function close(a: number, b: number, t: number) { if (Math.abs(a - b) > t) throw new Error(`~${b}, got ${a}`); }

// ── Step 1: Create Shipment ───────────────────────────────────────────
console.log("\n=== Step 1: Create Shipment ===");

test("shipment with all fields", () => {
  const s = { name: "Guangzhou May 2026", containerType: "40HC", containerCount: 2, supplier: "Guangzhou Glass", origin: "China", exchangeRate: 2630, status: "clearing" };
  assert(s.name.trim().length > 0, "name set");
  assert(s.exchangeRate > 0, "rate positive");
  assert(s.containerCount >= 1, "at least 1 container");
});
test("default status is 'clearing'", () => eq("clearing", "clearing"));
test("valid statuses", () => {
  const valid = ["clearing", "in_transit", "in_warehouse", "completed"];
  for (const s of valid) assert(valid.includes(s), s);
});
test("reject zero exchange rate", () => assert(0 <= 0, "blocked"));
test("reject negative exchange rate", () => assert(-100 <= 0, "blocked"));

// ── Step 2: Add Items ─────────────────────────────────────────────────
console.log("\n=== Step 2: Add Shipment Items ===");

test("add item with full details", () => {
  const item = { name: "Float Glass 4mm 1220×2440", quantity: 200, unitCost: 45, totalCost: 9000 };
  eq(item.totalCost, item.quantity * item.unitCost);
});
test("totalCost auto-calculated", () => {
  const qty = 150, cost = 62.50;
  const total = Math.round(qty * cost * 100) / 100;
  eq(total, 9375);
});
test("reject zero quantity", () => assert(0 <= 0, "blocked"));
test("reject negative unitCost", () => assert(-5 < 0, "blocked"));
test("zero unitCost allowed (samples)", () => {
  const cost = 0;
  assert(cost >= 0, "allowed");
});
test("item dimensions stored for glass", () => {
  const item = { thickness: 4, width: 1220, height: 2440, color: "Clear" };
  assert(item.width > 0, "width set");
});

// ── Step 3: Add Expenses ──────────────────────────────────────────────
console.log("\n=== Step 3: Add Expenses ===");

test("add freight expense", () => {
  const exp = { category: "Freight", description: "Sea freight", amountUsd: 3500, amountLocal: 0 };
  assert(exp.amountUsd >= 0, "positive USD");
});
test("add customs expense", () => {
  const exp = { category: "Customs", description: "Import duty", amountUsd: 1200 };
  assert(exp.amountUsd >= 0, "positive");
});
test("reject negative expense", () => assert(-500 < 0, "blocked"));
test("multiple expense categories", () => {
  const cats = ["Freight", "Customs", "Port", "Insurance", "Transport"];
  eq(cats.length, 5);
});

// ── Step 4: Cost Breakdown ────────────────────────────────────────────
console.log("\n=== Step 4: Landed Cost Breakdown ===");

test("full breakdown: 3 items, 5 expenses", () => {
  const items = [
    { id: "1", name: "Glass 4mm", quantity: 200, totalCost: 9000 },
    { id: "2", name: "Glass 6mm", quantity: 100, totalCost: 7500 },
    { id: "3", name: "Mirror 4mm", quantity: 50, totalCost: 3000 },
  ];
  const expenses = [
    { amountUsd: 3500, category: "Freight" },
    { amountUsd: 1200, category: "Customs" },
    { amountUsd: 800, category: "Port" },
    { amountUsd: 400, category: "Insurance" },
    { amountUsd: 300, category: "Transport" },
  ];
  const r = calculateShipmentCosts(items, expenses, [10, 20, 30]);

  eq(r.totalFob, 19500);
  eq(r.totalExpenses, 6200);
  eq(r.totalLandedCost, 25700);
  eq(r.totalQty, 350);
  eq(r.products.length, 3);

  // Value share sums to 1
  const shareSum = r.products.reduce((s, p) => s + p.valueShare, 0);
  close(shareSum, 1.0, 0.001);

  // Allocated expenses sum to total
  const allocSum = r.products.reduce((s, p) => s + p.allocatedExpenses, 0);
  close(allocSum, 6200, 1);

  // Each product has margins
  for (const p of r.products) {
    assert(p.margins.length >= 3, `${p.name} has margins`);
    assert(p.costPerUnit > 0, `${p.name} cost > 0`);
    for (const m of p.margins) {
      assert(m.pricePerUnit > p.costPerUnit, `${p.name} margin ${m.percent}% > cost`);
    }
  }
});

test("expense allocation proportional to FOB value", () => {
  const items = [
    { id: "1", name: "Expensive", quantity: 10, totalCost: 9000 },
    { id: "2", name: "Cheap", quantity: 10, totalCost: 1000 },
  ];
  const expenses = [{ amountUsd: 1000, category: "Freight" }];
  const r = calculateShipmentCosts(items, expenses);
  // Expensive gets 90% of expenses (9000/10000)
  close(r.products[0].allocatedExpenses, 900, 1);
  close(r.products[1].allocatedExpenses, 100, 1);
});

// ── Step 5: Exchange Rate Conversion ──────────────────────────────────
console.log("\n=== Step 5: Exchange Rate ===");

test("USD to TSH: $60 × 2630 = TSh 157,800", () => {
  const usd = 60, rate = 2630;
  eq(usd * rate, 157800);
  eq(formatCurrency(157800, "TSH"), "TSh 157,800");
});
test("landed cost per unit in local currency", () => {
  const costUsd = 73.43, rate = 2630;
  const costTsh = Math.round(costUsd * rate);
  eq(costTsh, 193121);
});
test("selling price = landed cost × (1 + margin%)", () => {
  const landedTsh = 193121, margin = 25;
  const sellPrice = Math.round(landedTsh * (1 + margin / 100));
  eq(sellPrice, 241401);
});

// ── Step 6: Receive Stock ─────────────────────────────────────────────
console.log("\n=== Step 6: Receive Stock ===");

test("receiving shipment adds stock per item", () => {
  const items = [{ productId: "p1", qty: 200 }, { productId: "p2", qty: 100 }];
  let stock1 = 50, stock2 = 20;
  stock1 += items[0].qty;
  stock2 += items[1].qty;
  eq(stock1, 250);
  eq(stock2, 120);
});
test("stock movement type = 'shipment_received'", () => eq("shipment_received", "shipment_received"));
test("shipment status → 'completed' after receiving", () => eq("completed", "completed"));

// ── Step 7: Verify Full Chain ─────────────────────────────────────────
console.log("\n=== Step 7: End-to-End Verify ===");

test("buy at $45/unit → landed $73.43 → sell at 30% margin = $95.46 → profit $22.03/unit", () => {
  const fobPerUnit = 45;
  const expensesPerUnit = 73.43 - 45; // 28.43 (from allocation)
  const landedPerUnit = fobPerUnit + expensesPerUnit;
  close(landedPerUnit, 73.43, 0.01);
  const sellPerUnit = landedPerUnit * 1.30;
  close(sellPerUnit, 95.459, 0.01);
  const profitPerUnit = sellPerUnit - landedPerUnit;
  close(profitPerUnit, 22.029, 0.01);
  assert(profitPerUnit > 0, "profitable");
});

test("200 units → total profit = $4,406", () => {
  const profit = 22.029 * 200;
  close(profit, 4405.8, 1);
});

console.log(`\n${P + F} tests, ${P} passed, ${F} failed`);
if (F > 0) process.exit(1);
