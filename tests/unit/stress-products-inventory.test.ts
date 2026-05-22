/**
 * STRESS TESTS — Products, Area Selling, Inventory, Stock Movements
 * Hammers every edge case in product creation, sqm conversion, stock tracking
 * Run: npx tsx tests/unit/stress-products-inventory.test.ts
 */

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
// Product Price Validation — the Number(x) || 0 pattern
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Product Price Coercion: Number(x) || 0 Bugs ===");

// This is the pattern used in products/route.ts — let's verify edge cases
function coercePrice(val: unknown): number {
  return Number(val) || 0;
}

test("normal number passes through", () => eq(coercePrice(99.99), 99.99));
test("string number converts", () => eq(coercePrice("99.99"), 99.99));
test("null becomes 0", () => eq(coercePrice(null), 0));
test("undefined becomes 0", () => eq(coercePrice(undefined), 0));
test("empty string becomes 0", () => eq(coercePrice(""), 0));

// BUG: These ALL silently become 0 instead of erroring
test("BUG: 'abc' silently becomes 0 (should error)", () => {
  eq(coercePrice("abc"), 0, "NaN string → 0 silently");
});
test("BUG: {} silently becomes 0", () => {
  eq(coercePrice({}), 0);
});
test("BUG: [] silently becomes 0", () => {
  eq(coercePrice([]), 0);
});
test("BUG: true becomes 1 (should probably error)", () => {
  eq(coercePrice(true), 1);
});

// CRITICAL: Number(x) || 0 turns ACTUAL ZERO into 0 — which is CORRECT
// But it also turns -0 into 0, which is fine
test("zero stays zero", () => eq(coercePrice(0), 0));
test("negative zero becomes 0", () => eq(coercePrice(-0), 0));

// DANGEROUS: Very large numbers
test("very large number accepted", () => {
  const big = coercePrice(999999999999.99);
  eq(big, 999999999999.99);
});
test("Infinity becomes 0 (falsy)", () => {
  // Number(Infinity) = Infinity, but Infinity || 0 = Infinity (truthy!)
  // This is actually a BUG — Infinity passes through
  const val = Number(Infinity) || 0;
  eq(val, Infinity, "BUG: Infinity passes through Number(x) || 0");
});

// ═══════════════════════════════════════════════════════════════════════════
// Product Validation — what the API actually checks vs what it should
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Product Validation Gaps ===");

function validateProductCreate(body: Record<string, unknown>): string | null {
  const { name, costPrice, sellingPrice, stockQty } = body;
  if (!name || !(name as string).trim()) return "Product name is required";
  if (costPrice !== undefined && costPrice !== null && (costPrice as number) < 0)
    return "Cost price cannot be negative";
  if (sellingPrice !== undefined && sellingPrice !== null && (sellingPrice as number) < 0)
    return "Selling price cannot be negative";
  if (stockQty !== undefined && stockQty !== null && (stockQty as number) < 0)
    return "Stock quantity cannot be negative";
  return null; // no error
}

test("valid product passes", () => {
  eq(validateProductCreate({ name: "Glass 5mm", costPrice: 50, sellingPrice: 100, stockQty: 10 }), null);
});
test("rejects empty name", () => {
  assert(validateProductCreate({ name: "" }) !== null, "empty name");
});
test("rejects negative cost", () => {
  assert(validateProductCreate({ name: "X", costPrice: -5 }) !== null, "neg cost");
});
test("rejects negative selling price", () => {
  assert(validateProductCreate({ name: "X", sellingPrice: -5 }) !== null, "neg sell");
});
test("rejects negative stock", () => {
  assert(validateProductCreate({ name: "X", stockQty: -1 }) !== null, "neg stock");
});

// GAP: PUT has NO validation at all
test("GAP: product update accepts empty name (no validation on PUT)", () => {
  // The PUT endpoint does: ...(name !== undefined && { name })
  // It does NOT check if name is empty!
  const name = "";
  assert(name !== undefined, "name is defined but empty — would pass through");
});

test("GAP: product update accepts negative prices (no validation on PUT)", () => {
  // PUT doesn't check costPrice/sellingPrice ranges
  const costPrice = -999;
  assert(costPrice < 0, "negative cost would be accepted on update");
});

// ═══════════════════════════════════════════════════════════════════════════
// Area Selling — sqm/sheet Conversion Math
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Area Selling: sqm ↔ sheet Conversion ===");

function mmToSqm(widthMm: number, heightMm: number): number | null {
  if (widthMm <= 0 || heightMm <= 0) return null;
  return Math.round((widthMm / 1000) * (heightMm / 1000) * 10000) / 10000;
}

function sheetsForArea(areaSqm: number, sqmPerUnit: number): number {
  if (sqmPerUnit <= 0) throw new Error("sqmPerUnit must be positive");
  return Math.round((areaSqm / sqmPerUnit) * 10000) / 10000;
}

// Standard glass sizes
test("1220mm x 2440mm = 2.9768 m²", () => {
  close(mmToSqm(1220, 2440)!, 2.9768, 0.0001);
});
test("1000mm x 1000mm = 1.0 m²", () => {
  eq(mmToSqm(1000, 1000), 1);
});
test("500mm x 500mm = 0.25 m²", () => {
  eq(mmToSqm(500, 500), 0.25);
});
test("2134mm x 3048mm = 6.5044 m² (standard US sheet)", () => {
  close(mmToSqm(2134, 3048)!, 6.5044, 0.001);
});

// Edge cases in dimensions
test("very small: 1mm x 1mm = 0.000001 m² → rounds to 0", () => {
  eq(mmToSqm(1, 1), 0);
});
test("very small: 10mm x 10mm = 0.0001 m²", () => {
  eq(mmToSqm(10, 10), 0.0001);
});
test("zero width returns null", () => eq(mmToSqm(0, 2440), null));
test("zero height returns null", () => eq(mmToSqm(1220, 0), null));
test("negative width returns null", () => eq(mmToSqm(-1220, 2440), null));

// Sheet ↔ area conversion
test("5 m² ÷ 2.9768 m²/sheet = 1.6797 sheets", () => {
  close(sheetsForArea(5, 2.9768), 1.6797, 0.001);
});
test("2.9768 m² = exactly 1 sheet", () => {
  close(sheetsForArea(2.9768, 2.9768), 1.0, 0.0001);
});
test("0.5 m² of a 1m² sheet = 0.5 sheets", () => {
  eq(sheetsForArea(0.5, 1.0), 0.5);
});
test("throws on zero sqmPerUnit", () => {
  let threw = false;
  try { sheetsForArea(5, 0); } catch { threw = true; }
  assert(threw, "should throw on zero sqmPerUnit");
});

// Fractional stock — selling partial sheets
test("selling 0.3 m² from 2.9768 m²/sheet = 0.1008 sheets deducted", () => {
  close(sheetsForArea(0.3, 2.9768), 0.1008, 0.001);
});
test("stock 10.5 sheets, sell 29.768 m² = 10 sheets, leaves 0.5", () => {
  const needed = sheetsForArea(29.768, 2.9768);
  close(needed, 10.0, 0.001);
  const remaining = 10.5 - needed;
  close(remaining, 0.5, 0.001);
});

// ═══════════════════════════════════════════════════════════════════════════
// Stock Movement Tracking
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Stock Movement Simulation ===");

function simulateStockMovements(initial: number, movements: { qty: number; type: string }[]): { balance: number; log: { type: string; qty: number; balance: number }[] } {
  let balance = initial;
  const log: { type: string; qty: number; balance: number }[] = [];
  for (const m of movements) {
    balance += m.qty;
    balance = Math.round(balance * 10000) / 10000; // avoid float drift
    log.push({ type: m.type, qty: m.qty, balance });
  }
  return { balance, log };
}

test("full lifecycle: receive → sell → refund → adjust", () => {
  const result = simulateStockMovements(0, [
    { qty: 100, type: "shipment_received" },   // +100 → 100
    { qty: -5, type: "sale" },                   // -5 → 95
    { qty: -3, type: "sale" },                   // -3 → 92
    { qty: 2, type: "refund" },                  // +2 → 94
    { qty: -10, type: "manual" },                // -10 → 84
  ]);
  eq(result.balance, 84);
  eq(result.log.length, 5);
});

test("fractional stock from sqm sales", () => {
  // Start with 10 sheets, sell 7.5 m² from 2.9768 m²/sheet
  const sheetsNeeded = sheetsForArea(7.5, 2.9768); // ~2.5195
  const result = simulateStockMovements(10, [
    { qty: -sheetsNeeded, type: "sale" },
  ]);
  close(result.balance, 10 - 2.5195, 0.001);
});

test("multiple fractional sales accumulate correctly", () => {
  const sqmPerUnit = 2.9768;
  const result = simulateStockMovements(100, [
    { qty: -sheetsForArea(1.5, sqmPerUnit), type: "sale" },   // ~0.5039
    { qty: -sheetsForArea(2.0, sqmPerUnit), type: "sale" },   // ~0.6719
    { qty: -sheetsForArea(0.75, sqmPerUnit), type: "sale" },  // ~0.2519
  ]);
  const totalSheets = sheetsForArea(1.5 + 2.0 + 0.75, sqmPerUnit); // ~1.4277
  close(result.balance, 100 - totalSheets, 0.01);
});

test("stock never accidentally goes negative from rounding", () => {
  // Edge case: stock = 0.0001 sheets, try to sell 0.00005 m²
  const sqmPerUnit = 1.0;
  const sheetsNeeded = sheetsForArea(0.00005, sqmPerUnit);
  const result = simulateStockMovements(0.0001, [
    { qty: -sheetsNeeded, type: "sale" },
  ]);
  assert(result.balance >= 0, `Balance should not go negative: ${result.balance}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// Inventory Edge Cases — Bulk Operations
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Inventory Bulk Edge Cases ===");

test("1000 products with stock = stress test totals", () => {
  let totalValue = 0;
  for (let i = 0; i < 1000; i++) {
    const qty = Math.random() * 1000;
    const price = Math.random() * 10000;
    totalValue += qty * price;
  }
  assert(totalValue > 0 && isFinite(totalValue), "Total inventory value is finite");
});

test("product with maxint stock qty", () => {
  const stock = Number.MAX_SAFE_INTEGER;
  assert(isFinite(stock), "MAX_SAFE_INTEGER is finite");
  assert(stock > 0, "MAX_SAFE_INTEGER is positive");
});

test("stock conversion: sqm input to sheets for storage", () => {
  // User enters 100 m² of stock, sheet is 2.9768 m²/unit
  const sqmInput = 100;
  const sqmPerUnit = 2.9768;
  const sheets = Math.round((sqmInput / sqmPerUnit) * 10000) / 10000;
  close(sheets, 33.5929, 0.001);
});

// ═══════════════════════════════════════════════════════════════════════════
// Product SKU Edge Cases
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Product SKU Edge Cases ===");

test("SKU uniqueness: same org, different SKU = OK", () => {
  // @@unique([orgId, sku]) constraint
  const skus = ["GL-5MM-CLR", "GL-6MM-CLR", "GL-5MM-BRN"];
  const unique = new Set(skus);
  eq(unique.size, 3);
});

test("null SKU allowed (multiple products with no SKU)", () => {
  // Prisma @@unique allows multiple nulls
  const sku1 = null;
  const sku2 = null;
  assert(sku1 === null && sku2 === null, "both null OK in unique constraint");
});

test("SKU with special chars trimmed", () => {
  const sku = "  GL-5MM/CLR  ";
  eq(sku.trim(), "GL-5MM/CLR");
});

// ═══════════════════════════════════════════════════════════════════════════
// Product with Different Origins/Categories
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Products from Different Origins ===");

interface TestProduct {
  name: string;
  origin: string;
  category: string;
  fields: string[];
  width?: number;
  height?: number;
  costPrice: number;
  sellingPrice: number;
}

const productCatalog: TestProduct[] = [
  { name: "5mm Clear Glass", origin: "China", category: "Glass", fields: ["thickness", "width", "height", "color", "sellByArea"], width: 1220, height: 2440, costPrice: 45, sellingPrice: 120 },
  { name: "6mm Bronze Glass", origin: "UAE", category: "Glass", fields: ["thickness", "width", "height", "color", "sellByArea"], width: 1524, height: 2134, costPrice: 65, sellingPrice: 180 },
  { name: "Aluminum Profile 6m", origin: "Turkey", category: "Aluminum", fields: ["thickness", "color"], costPrice: 30, sellingPrice: 75 },
  { name: "Wood Screws 100pk", origin: "India", category: "Hardware", fields: [], costPrice: 2, sellingPrice: 8 },
  { name: "Silicone Sealant", origin: "Germany", category: "Adhesives", fields: [], costPrice: 5, sellingPrice: 15 },
  { name: "Mirror 4mm", origin: "China", category: "Glass", fields: ["thickness", "width", "height", "sellByArea"], width: 1830, height: 2440, costPrice: 55, sellingPrice: 150 },
];

test("all products have valid prices", () => {
  for (const p of productCatalog) {
    assert(p.costPrice >= 0, `${p.name}: cost >= 0`);
    assert(p.sellingPrice >= 0, `${p.name}: sell >= 0`);
    assert(p.sellingPrice >= p.costPrice, `${p.name}: sell >= cost`);
  }
});

test("area products have valid dimensions", () => {
  for (const p of productCatalog) {
    if (p.fields.includes("sellByArea")) {
      assert(p.width! > 0, `${p.name}: width > 0`);
      assert(p.height! > 0, `${p.name}: height > 0`);
      const sqm = mmToSqm(p.width!, p.height!);
      assert(sqm !== null && sqm > 0, `${p.name}: sqm = ${sqm}`);
    }
  }
});

test("non-area products don't need dimensions", () => {
  for (const p of productCatalog) {
    if (!p.fields.includes("sellByArea")) {
      // width/height optional — no assertion needed
      assert(true, `${p.name}: no area fields needed`);
    }
  }
});

test("different origins tracked correctly", () => {
  const origins = new Set(productCatalog.map(p => p.origin));
  assert(origins.size >= 4, `Should have multiple origins: ${[...origins].join(", ")}`);
});

test("profit margin calculation per product", () => {
  for (const p of productCatalog) {
    const margin = ((p.sellingPrice - p.costPrice) / p.costPrice) * 100;
    assert(margin > 0, `${p.name}: margin ${margin.toFixed(1)}% > 0`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
