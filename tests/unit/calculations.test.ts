/**
 * Unit tests for calculations.ts
 * Run: npx tsx tests/unit/calculations.test.ts
 */

import { calculateShipmentCosts, formatCurrency, formatNumber } from "../../src/lib/calculations";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } catch (e: unknown) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}`);
    console.log(`        ${msg}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function assertEq(actual: unknown, expected: unknown, msg?: string) {
  if (actual !== expected) {
    throw new Error(msg || `Expected ${expected}, got ${actual}`);
  }
}

function assertClose(actual: number, expected: number, tolerance: number, msg?: string) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(msg || `Expected ~${expected}, got ${actual} (tolerance ${tolerance})`);
  }
}

// ── formatCurrency ──────────────────────────────────────────────────────

console.log("\n=== formatCurrency ===");

test("formats USD correctly", () => {
  assertEq(formatCurrency(1234.56, "USD"), "$1,234.56");
});

test("formats TSH with no decimals", () => {
  assertEq(formatCurrency(1234.56, "TSH"), "TSh 1,235");
});

test("formats TZS same as TSH", () => {
  assertEq(formatCurrency(1234.56, "TZS"), "TSh 1,235");
});

test("handles zero amount", () => {
  assertEq(formatCurrency(0, "USD"), "$0.00");
});

test("handles negative amount", () => {
  assertEq(formatCurrency(-500, "USD"), "$-500.00");
});

test("defaults to USD when no currency", () => {
  assertEq(formatCurrency(100), "$100.00");
});

test("handles very large numbers", () => {
  const result = formatCurrency(1000000000, "USD");
  assert(result.includes("1,000,000,000"), `Large number format: ${result}`);
});

test("handles NaN gracefully", () => {
  assertEq(formatCurrency(NaN, "USD"), "$0");
});

test("handles null-like input gracefully", () => {
  assertEq(formatCurrency(undefined as unknown as number, "USD"), "$0");
});

// ── formatNumber ────────────────────────────────────────────────────────

console.log("\n=== formatNumber ===");

test("formats with 2 decimals by default", () => {
  assertEq(formatNumber(1234.567), "1,234.57");
});

test("formats with 0 decimals", () => {
  assertEq(formatNumber(1234.567, 0), "1,235");
});

test("handles zero", () => {
  assertEq(formatNumber(0, 2), "0.00");
});

test("handles NaN", () => {
  assertEq(formatNumber(NaN), "0");
});

test("handles null", () => {
  assertEq(formatNumber(null as unknown as number), "0");
});

test("handles undefined", () => {
  assertEq(formatNumber(undefined as unknown as number), "0");
});

// ── calculateShipmentCosts ──────────────────────────────────────────────

console.log("\n=== calculateShipmentCosts ===");

test("calculates basic shipment with items and expenses", () => {
  const items = [
    { id: "1", name: "Glass A", quantity: 100, totalCost: 5000 },
    { id: "2", name: "Glass B", quantity: 50, totalCost: 3000 },
  ];
  const expenses = [
    { amountUsd: 1000, category: "Freight" },
    { amountUsd: 500, category: "Customs" },
  ];

  const result = calculateShipmentCosts(items, expenses);

  assertEq(result.totalFob, 8000);
  assertEq(result.totalExpenses, 1500);
  assertEq(result.totalLandedCost, 9500);
  assertEq(result.totalQty, 150);
  assertClose(result.avgCostPerUnit, 63.33, 0.01);
  assertEq(result.products.length, 2);

  // Glass A: 5000/8000 = 62.5% share, allocated = 937.50
  const glassA = result.products[0];
  assertEq(glassA.valueShare, 0.625);
  assertEq(glassA.allocatedExpenses, 937.5);
  assertEq(glassA.landedCost, 5937.5);
  assertClose(glassA.costPerUnit, 59.38, 0.01);
});

test("handles empty items array", () => {
  const result = calculateShipmentCosts([], []);
  assertEq(result.totalFob, 0);
  assertEq(result.totalExpenses, 0);
  assertEq(result.totalLandedCost, 0);
  assertEq(result.avgCostPerUnit, 0);
  assertEq(result.totalQty, 0);
  assertEq(result.products.length, 0);
});

test("handles zero quantity items (avoid division by zero)", () => {
  const items = [{ id: "1", name: "Test", quantity: 0, totalCost: 1000 }];
  const result = calculateShipmentCosts(items, []);
  assertEq(result.products[0].costPerUnit, 0);
});

test("handles expenses with no items", () => {
  const result = calculateShipmentCosts([], [{ amountUsd: 500, category: "Freight" }]);
  assertEq(result.totalExpenses, 500);
  assertEq(result.totalLandedCost, 500);
});

test("groups expenses by category", () => {
  const expenses = [
    { amountUsd: 100, category: "Freight" },
    { amountUsd: 200, category: "Customs" },
    { amountUsd: 300, category: "Freight" },
  ];
  const result = calculateShipmentCosts(
    [{ id: "1", name: "Test", quantity: 10, totalCost: 1000 }],
    expenses
  );
  assertEq(result.expensesByCategory.length, 2);
  const freight = result.expensesByCategory.find((e) => e.category === "Freight");
  assertEq(freight?.total, 400);
});

test("generates correct margin prices", () => {
  const items = [{ id: "1", name: "Test", quantity: 100, totalCost: 10000 }];
  const result = calculateShipmentCosts(items, [], [10, 20]);
  const margins = result.products[0].margins;
  assertEq(margins.length, 2);
  assertEq(margins[0].percent, 10);
  assertEq(margins[0].pricePerUnit, 110); // 100 * 1.10
  assertEq(margins[1].percent, 20);
  assertEq(margins[1].pricePerUnit, 120); // 100 * 1.20
});

// ── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
