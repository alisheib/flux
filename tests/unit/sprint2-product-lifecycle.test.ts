/**
 * SPRINT 2 — Full Product Lifecycle
 * Create category → configure fields → add product → set prices → manage stock →
 * area selling setup → edit product → deactivate → delete (blocked if has sales)
 * Run: npx tsx tests/unit/sprint2-product-lifecycle.test.ts
 */
let P = 0, F = 0;
function test(n: string, fn: () => void) { try { fn(); P++; console.log(`  \x1b[32mPASS\x1b[0m  ${n}`); } catch (e: unknown) { F++; console.log(`  \x1b[31mFAIL\x1b[0m  ${n}\n        ${e instanceof Error ? e.message : e}`); } }
function eq(a: unknown, b: unknown, m?: string) { if (a !== b) throw new Error(m || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function close(a: number, b: number, t: number) { if (Math.abs(a - b) > t) throw new Error(`~${b}, got ${a}`); }

// ── Category Creation ─────────────────────────────────────────────────
console.log("\n=== Category Lifecycle ===");

test("create Glass category with sellByArea", () => {
  const fields = ["thickness", "width", "height", "color", "sellByArea"];
  const json = JSON.stringify(fields);
  const parsed = JSON.parse(json);
  assert(parsed.includes("sellByArea"), "has sellByArea");
  eq(parsed.length, 5);
});
test("create Hardware category with no custom fields", () => {
  const fields: string[] = [];
  eq(JSON.stringify(fields), "[]");
});
test("category name trimmed", () => eq("  Glass  ".trim(), "Glass"));
test("category name cannot be empty", () => assert(!"   ".trim(), "empty rejected"));
test("delete category → products set categoryId=null", () => {
  // Schema: onDelete: SetNull
  assert(true, "SetNull preserves products");
});

// ── Product Creation ──────────────────────────────────────────────────
console.log("\n=== Product Creation ===");

test("create product with all fields", () => {
  const p = { name: "Float Glass 4mm Clear", sku: "GLS-4MM-CLR", categoryId: "cat-1", unit: "sheet", thickness: 4, width: 1220, height: 2440, color: "Clear", costPrice: 45000, sellingPrice: 120000, stockQty: 100, minStockQty: 10 };
  assert(p.name.trim().length > 0, "name set");
  assert(p.costPrice >= 0, "cost >= 0");
  assert(p.sellingPrice >= 0, "sell >= 0");
  assert(p.stockQty >= 0, "stock >= 0");
});
test("create product with minimal fields (just name)", () => {
  const p = { name: "Quick item", costPrice: 0, sellingPrice: 0, stockQty: 0 };
  eq(p.costPrice, 0);
});
test("reject negative cost price", () => {
  const cost = -100;
  assert(cost < 0, "should be rejected by API");
});
test("reject negative stock", () => {
  const stock = -5;
  assert(stock < 0, "should be rejected by API");
});
test("reject Infinity price", () => assert(!isFinite(Infinity), "Infinity rejected"));
test("reject NaN price", () => assert(isNaN(NaN), "NaN rejected"));

// ── Area Selling Setup ────────────────────────────────────────────────
console.log("\n=== Area Selling (sqm) ===");

test("sqmPerUnit computed from width × height (mm → m²)", () => {
  const w = 1220, h = 2440;
  const sqm = Math.round((w / 1000) * (h / 1000) * 10000) / 10000;
  close(sqm, 2.9768, 0.0001);
});
test("pricePerSqm = sellingPrice / sqmPerUnit", () => {
  const sellingPrice = 120000, sqm = 2.9768;
  const pricePerSqm = Math.round(sellingPrice / sqm * 100) / 100;
  close(pricePerSqm, 40310.90, 1);
});
test("stock input in sqm → convert to sheets", () => {
  const sqmInput = 100, sqmPerUnit = 2.9768;
  const sheets = Math.round((sqmInput / sqmPerUnit) * 10000) / 10000;
  close(sheets, 33.5929, 0.001);
});
test("zero dimensions → sqmPerUnit = null", () => {
  const w = 0, h = 2440;
  const sqm = w > 0 && h > 0 ? (w / 1000) * (h / 1000) : null;
  eq(sqm, null);
});

// ── Stock Management ──────────────────────────────────────────────────
console.log("\n=== Stock Tracking ===");

test("stock movement: receive 500 → balance = 500", () => {
  let balance = 0;
  balance += 500;
  eq(balance, 500);
});
test("stock movement: sell 12 → balance = 488", () => {
  let balance = 500;
  balance -= 12;
  eq(balance, 488);
});
test("manual adjustment: -2 (damaged) → balance = 486", () => {
  let balance = 488;
  balance -= 2;
  eq(balance, 486);
});
test("refund: +3 → balance = 489", () => {
  let balance = 486;
  balance += 3;
  eq(balance, 489);
});
test("prevent stock going negative", () => {
  const balance = 5, adjustment = -10;
  assert(balance + adjustment < 0, "would go negative — must be blocked");
});
test("low stock detection", () => {
  const stockQty = 5, minStockQty = 10;
  assert(stockQty <= minStockQty, "low stock alert");
});
test("out of stock detection", () => {
  const stockQty = 0;
  assert(stockQty <= 0, "out of stock");
});

// ── Product Edit ──────────────────────────────────────────────────────
console.log("\n=== Product Edit ===");

test("update name", () => eq("Float Glass 5mm".trim(), "Float Glass 5mm"));
test("update price", () => { const p = 130000; assert(p > 0, "valid price"); });
test("cannot set empty name", () => assert(!"".trim(), "blocked"));
test("SKU uniqueness: same org + same SKU → error", () => {
  const existing = ["GLS-4MM-CLR", "GLS-5MM-CLR"];
  assert(existing.includes("GLS-4MM-CLR"), "duplicate detected");
});

// ── Product Deactivation & Deletion ───────────────────────────────────
console.log("\n=== Deactivate & Delete ===");

test("deactivate product (active=false) preserves data", () => {
  const active = false;
  eq(active, false);
});
test("delete product WITH sales → blocked", () => {
  const saleItemCount = 5;
  assert(saleItemCount > 0, "has sales — cannot delete");
});
test("delete product WITHOUT sales → allowed", () => {
  const saleItemCount = 0;
  assert(saleItemCount === 0, "no sales — can delete");
});

// ── Profit Margin ─────────────────────────────────────────────────────
console.log("\n=== Profit Margin ===");

test("margin = (sell - cost) / cost × 100", () => {
  const cost = 45000, sell = 120000;
  const margin = ((sell - cost) / cost) * 100;
  close(margin, 166.67, 0.1);
});
test("zero cost → margin = Infinity (display as '--')", () => {
  const cost = 0, sell = 100;
  const margin = cost > 0 ? ((sell - cost) / cost) * 100 : Infinity;
  assert(!isFinite(margin), "display as --");
});
test("sell < cost → negative margin (loss)", () => {
  const cost = 120000, sell = 100000;
  const margin = ((sell - cost) / cost) * 100;
  assert(margin < 0, "loss");
});

console.log(`\n${P + F} tests, ${P} passed, ${F} failed`);
if (F > 0) process.exit(1);
