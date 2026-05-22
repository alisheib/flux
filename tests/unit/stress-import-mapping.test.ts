/**
 * STRESS TESTS — Excel Import Column Mapping + Real Spreadsheet Simulation
 * Simulates actual Excel files with different column names, corrupt columns,
 * partial data, mixed types, and verifies the mapping + validation pipeline.
 *
 * Run: npx tsx tests/unit/stress-import-mapping.test.ts
 */

let P = 0, F = 0;
function test(n: string, fn: () => void) { try { fn(); P++; console.log(`  \x1b[32mPASS\x1b[0m  ${n}`); } catch (e: unknown) { F++; console.log(`  \x1b[31mFAIL\x1b[0m  ${n}\n        ${e instanceof Error ? e.message : e}`); } }
function eq(a: unknown, b: unknown, m?: string) { if (a !== b) throw new Error(m || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

// ═══════════════════════════════════════════════════════════════════════════
// The mapping engine — replicates what the UI + validator does
// ═══════════════════════════════════════════════════════════════════════════

interface FluxField { id: string; label: string; required: boolean; }
interface FieldRule { field: string; type: string; required: boolean; min?: number; max?: number; regex?: string; allowed?: string[]; }

const FLUX_FIELDS: FluxField[] = [
  { id: "sku", label: "SKU", required: true },
  { id: "name", label: "Product name", required: true },
  { id: "category", label: "Category", required: false },
  { id: "stock", label: "Stock quantity", required: true },
  { id: "cost", label: "Cost price", required: true },
  { id: "selling", label: "Selling price", required: false },
  { id: "supplier", label: "Supplier", required: false },
  { id: "min", label: "Min stock", required: false },
  { id: "desc", label: "Description", required: false },
];

const RULES: FieldRule[] = [
  { field: "sku", type: "text", required: true, regex: "^[A-Z0-9][A-Z0-9\\-_]+$" },
  { field: "stock", type: "number", required: true, min: 0, max: 999999 },
  { field: "cost", type: "number", required: true, min: 0 },
];

// Mapping: excelCol → fluxFieldId (or "" for unmapped, "__ignore__" for ignored)
type Mapping = Record<string, string>;

function applyMapping(row: Record<string, unknown>, mapping: Mapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [excelCol, fluxId] of Object.entries(mapping)) {
    if (!fluxId || fluxId === "__ignore__") continue;
    out[fluxId] = row[excelCol];
  }
  return out;
}

function validateMappedRow(mapped: Record<string, unknown>, rules: FieldRule[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const rule of rules) {
    const raw = mapped[rule.field];
    const val = raw == null ? "" : String(raw).trim();
    if (rule.required && val === "") { errors.push(`${rule.field} is required`); continue; }
    if (val === "") continue;
    if (rule.type === "number") {
      const num = Number(val);
      if (isNaN(num) || !isFinite(num)) { errors.push(`${rule.field}: "${val}" is not a number`); continue; }
      if (rule.min !== undefined && num < rule.min) errors.push(`${rule.field}: ${num} below min ${rule.min}`);
      if (rule.max !== undefined && num > rule.max) errors.push(`${rule.field}: ${num} above max ${rule.max}`);
    }
    if (rule.type === "text" && rule.regex) {
      try { if (!new RegExp(rule.regex).test(val)) errors.push(`${rule.field}: "${val}" doesn't match pattern`); } catch {}
    }
  }
  return { valid: errors.length === 0, errors };
}

function processExcel(rows: Record<string, unknown>[], mapping: Mapping, rules: FieldRule[]) {
  let valid = 0, errors = 0, skipped = 0;
  const errorLog: { row: number; errors: string[] }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const isEmpty = Object.values(rows[i]).every(v => v === "" || v == null);
    if (isEmpty) { skipped++; continue; }
    const mapped = applyMapping(rows[i], mapping);
    const result = validateMappedRow(mapped, rules);
    if (result.valid) valid++;
    else { errors++; errorLog.push({ row: i + 1, errors: result.errors }); }
  }
  return { total: rows.length, valid, errors, skipped, errorLog };
}

// ═══════════════════════════════════════════════════════════════════════════
// GOOD EXCEL #1: Standard column names, clean data
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== GOOD EXCEL: Standard columns, clean data ===");

const GOOD_MAPPING: Mapping = {
  "SKU": "sku", "Product Name": "name", "Category": "category",
  "Qty": "stock", "Unit Price": "cost", "Supplier": "supplier",
};

const GOOD_ROWS = [
  { "SKU": "GLS-4MM-CLR", "Product Name": "Float glass 4mm clear", "Category": "Glass", "Qty": 180, "Unit Price": 45000, "Supplier": "Guangzhou Glass" },
  { "SKU": "GLS-6MM-BRN", "Product Name": "Float glass 6mm bronze", "Category": "Glass", "Qty": 100, "Unit Price": 65000, "Supplier": "Guangzhou Glass" },
  { "SKU": "CMT-50KG", "Product Name": "Cement 50kg bag", "Category": "Cement", "Qty": 500, "Unit Price": 18000, "Supplier": "Twiga Cement" },
  { "SKU": "RBR-10MM", "Product Name": "Rebar 10mm", "Category": "Rebar", "Qty": 200, "Unit Price": 12000, "Supplier": "Steel Masters" },
  { "SKU": "TLS-DRILL", "Product Name": "Drill bit set", "Category": "Tools", "Qty": 25, "Unit Price": 35000, "Supplier": "Tools Direct" },
];

test("good excel: all 5 rows valid", () => {
  const r = processExcel(GOOD_ROWS, GOOD_MAPPING, RULES);
  eq(r.total, 5); eq(r.valid, 5); eq(r.errors, 0); eq(r.skipped, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// GOOD EXCEL #2: Renamed columns — "Item Code" instead of "SKU"
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== GOOD EXCEL: Renamed columns (user remaps) ===");

const RENAMED_MAPPING: Mapping = {
  "Item Code": "sku", "Description": "name", "Type": "category",
  "Quantity": "stock", "Price (TZS)": "cost", "Vendor": "supplier",
  "Weight": "__ignore__",
};

const RENAMED_ROWS = [
  { "Item Code": "GLS-4MM-CLR", "Description": "Float glass 4mm", "Type": "Glass", "Quantity": 180, "Price (TZS)": 45000, "Vendor": "Guangzhou", "Weight": "12kg" },
  { "Item Code": "CMT-50KG", "Description": "Cement bag", "Type": "Cement", "Quantity": 500, "Price (TZS)": 18000, "Vendor": "Twiga", "Weight": "50kg" },
];

test("renamed cols: 'Item Code' maps to SKU → valid", () => {
  const r = processExcel(RENAMED_ROWS, RENAMED_MAPPING, RULES);
  eq(r.valid, 2); eq(r.errors, 0);
});

test("renamed cols: 'Weight' column ignored", () => {
  const mapped = applyMapping(RENAMED_ROWS[0], RENAMED_MAPPING);
  eq(mapped["weight"], undefined); // not mapped
  eq(mapped["sku"], "GLS-4MM-CLR"); // but sku is mapped
});

// ═══════════════════════════════════════════════════════════════════════════
// GOOD EXCEL #3: Arabic column names
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== GOOD EXCEL: Arabic column names ===");

const ARABIC_MAPPING: Mapping = {
  "رمز المنتج": "sku", "الاسم": "name", "الكمية": "stock", "السعر": "cost",
};

const ARABIC_ROWS = [
  { "رمز المنتج": "GLS-5MM", "الاسم": "زجاج 5 ملم", "الكمية": 100, "السعر": 50000 },
];

test("arabic cols mapped correctly", () => {
  const r = processExcel(ARABIC_ROWS, ARABIC_MAPPING, RULES);
  eq(r.valid, 1); eq(r.errors, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// CORRUPT EXCEL #1: Mixed types — string in number column
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== CORRUPT EXCEL: Type mismatches ===");

const CORRUPT_ROWS_1 = [
  { "SKU": "GLS-4MM", "Product Name": "Glass 4mm", "Category": "Glass", "Qty": "one hundred", "Unit Price": 45000, "Supplier": "X" },
  { "SKU": "GLS-5MM", "Product Name": "Glass 5mm", "Category": "Glass", "Qty": 100, "Unit Price": "N/A", "Supplier": "X" },
  { "SKU": "GLS-6MM", "Product Name": "Glass 6mm", "Category": "Glass", "Qty": -50, "Unit Price": 45000, "Supplier": "X" },
  { "SKU": "GLS-8MM", "Product Name": "Glass 8mm", "Category": "Glass", "Qty": 100, "Unit Price": 45000, "Supplier": "X" },
];

test("corrupt #1: 'one hundred' in qty → error", () => {
  const r = processExcel(CORRUPT_ROWS_1, GOOD_MAPPING, RULES);
  eq(r.errors, 3); // row 1: bad qty, row 2: bad price, row 3: negative qty
  eq(r.valid, 1); // row 4 is clean
});

test("corrupt #1: error log has correct row numbers", () => {
  const r = processExcel(CORRUPT_ROWS_1, GOOD_MAPPING, RULES);
  eq(r.errorLog[0].row, 1);
  assert(r.errorLog[0].errors.some(e => e.includes("not a number")), "qty NaN");
  eq(r.errorLog[1].row, 2);
  assert(r.errorLog[1].errors.some(e => e.includes("not a number")), "price NaN");
  eq(r.errorLog[2].row, 3);
  assert(r.errorLog[2].errors.some(e => e.includes("below min")), "negative qty");
});

// ═══════════════════════════════════════════════════════════════════════════
// CORRUPT EXCEL #2: Missing required fields
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== CORRUPT EXCEL: Missing required fields ===");

const CORRUPT_ROWS_2 = [
  { "SKU": "", "Product Name": "Glass", "Category": "Glass", "Qty": 100, "Unit Price": 45000, "Supplier": "X" },
  { "SKU": "GLS-5MM", "Product Name": "", "Category": "Glass", "Qty": 100, "Unit Price": 45000, "Supplier": "X" },
  { "SKU": "GLS-6MM", "Product Name": "Glass", "Category": "Glass", "Qty": "", "Unit Price": 45000, "Supplier": "X" },
  { "SKU": "GLS-7MM", "Product Name": "Glass", "Category": "Glass", "Qty": 100, "Unit Price": "", "Supplier": "X" },
  { "SKU": "GLS-8MM", "Product Name": "Glass", "Category": "", "Qty": 100, "Unit Price": 45000, "Supplier": "" },
];

test("missing required: row 1 no SKU, row 2 no name → name not in rules so OK, row 3 no qty, row 4 no cost, row 5 clean", () => {
  const r = processExcel(CORRUPT_ROWS_2, GOOD_MAPPING, RULES);
  // Row 1: sku empty → error (sku required in rules)
  // Row 2: name empty → NOT in RULES so validator doesn't catch it (name validation would be separate)
  // Row 3: qty empty → error (stock required)
  // Row 4: cost empty → error (cost required)
  // Row 5: category+supplier empty but those are optional → valid
  eq(r.errors, 3);
  eq(r.valid, 2); // rows 2 and 5 pass the rules
});

// ═══════════════════════════════════════════════════════════════════════════
// CORRUPT EXCEL #3: Extra columns, missing columns
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== CORRUPT EXCEL: Extra/missing columns ===");

test("excel has extra columns not in mapping → ignored safely", () => {
  const row = { "SKU": "A-001", "Product Name": "Test", "Qty": 10, "Unit Price": 100, "EXTRA_COL": "junk", "Notes2": "blah" };
  // Mapping only maps known cols, extras are just ignored
  const mapped = applyMapping(row, GOOD_MAPPING);
  eq(mapped["EXTRA_COL"], undefined);
  eq(mapped["Notes2"], undefined);
  eq(mapped["sku"], "A-001"); // mapped cols work
});

test("excel missing a mapped column → value is undefined → required check catches it", () => {
  const row = { "Product Name": "Test", "Qty": 10, "Unit Price": 100 };
  // SKU column doesn't exist in this row
  const mapped = applyMapping(row, GOOD_MAPPING);
  eq(mapped["sku"], undefined);
  const result = validateMappedRow(mapped, RULES);
  assert(!result.valid, "should fail — sku required");
  assert(result.errors.some(e => e.includes("sku is required")), "sku error");
});

// ═══════════════════════════════════════════════════════════════════════════
// CORRUPT EXCEL #4: Formula residue, Excel errors
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== CORRUPT EXCEL: Formula errors ===");

const FORMULA_ROWS = [
  { "SKU": "A-001", "Product Name": "Test", "Qty": "=SUM(B1:B10)", "Unit Price": 100 },
  { "SKU": "A-002", "Product Name": "Test", "Qty": "#REF!", "Unit Price": 100 },
  { "SKU": "A-003", "Product Name": "Test", "Qty": "#DIV/0!", "Unit Price": "#VALUE!" },
  { "SKU": "A-004", "Product Name": "Test", "Qty": 50, "Unit Price": 100 },
];

test("formula residue: =SUM, #REF!, #DIV/0! all caught as errors", () => {
  const r = processExcel(FORMULA_ROWS, GOOD_MAPPING, RULES);
  eq(r.valid, 1); // only row 4 is clean
  eq(r.errors, 3);
});

// ═══════════════════════════════════════════════════════════════════════════
// CORRUPT EXCEL #5: SKU pattern violations
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== CORRUPT EXCEL: Bad SKU patterns ===");

const BAD_SKU_ROWS = [
  { "SKU": "gls-4mm", "Product Name": "Glass", "Qty": 10, "Unit Price": 100 },       // lowercase
  { "SKU": "GLS 4MM", "Product Name": "Glass", "Qty": 10, "Unit Price": 100 },        // space
  { "SKU": "GLS/4MM@!", "Product Name": "Glass", "Qty": 10, "Unit Price": 100 },      // special chars
  { "SKU": "GLS-4MM-OK", "Product Name": "Glass", "Qty": 10, "Unit Price": 100 },     // valid
];

test("bad SKU patterns: 3 fail, 1 passes", () => {
  const r = processExcel(BAD_SKU_ROWS, GOOD_MAPPING, RULES);
  eq(r.valid, 1);
  eq(r.errors, 3);
});

// ═══════════════════════════════════════════════════════════════════════════
// CORRUPT EXCEL #6: Empty rows scattered throughout
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== CORRUPT EXCEL: Empty rows ===");

const EMPTY_SCATTERED = [
  { "SKU": "A-001", "Product Name": "Test", "Qty": 10, "Unit Price": 100 },
  { "SKU": "", "Product Name": "", "Qty": "", "Unit Price": "" },
  { "SKU": "A-002", "Product Name": "Test", "Qty": 20, "Unit Price": 200 },
  { "SKU": null, "Product Name": null, "Qty": null, "Unit Price": null },
  { "SKU": "A-003", "Product Name": "Test", "Qty": 30, "Unit Price": 300 },
];

test("empty rows skipped, data rows validated", () => {
  const r = processExcel(EMPTY_SCATTERED, GOOD_MAPPING, RULES);
  eq(r.total, 5);
  eq(r.skipped, 2); // rows 2 and 4
  eq(r.valid, 3);
  eq(r.errors, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// CORRUPT EXCEL #7: Huge numbers, overflow
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== CORRUPT EXCEL: Overflow/boundary values ===");

const OVERFLOW_ROWS = [
  { "SKU": "A-001", "Product Name": "Test", "Qty": 999999, "Unit Price": 100 },       // max allowed
  { "SKU": "A-002", "Product Name": "Test", "Qty": 1000000, "Unit Price": 100 },      // over max
  { "SKU": "A-003", "Product Name": "Test", "Qty": Infinity, "Unit Price": 100 },     // Infinity
  { "SKU": "A-004", "Product Name": "Test", "Qty": 0, "Unit Price": 0 },              // zeros — valid
];

test("overflow: max=999999, Infinity caught, 0 allowed", () => {
  const r = processExcel(OVERFLOW_ROWS, GOOD_MAPPING, RULES);
  eq(r.valid, 2);  // rows 1 and 4
  eq(r.errors, 2); // row 2 over max, row 3 Infinity
});

// ═══════════════════════════════════════════════════════════════════════════
// MIXED EXCEL: Real-world messy file — 20 rows, mix of good and bad
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== REAL-WORLD: 20-row messy file ===");

const MESSY_MAPPING: Mapping = {
  "Item Code": "sku", "Desc": "name", "QTY": "stock", "Cost": "cost",
  "Cat": "category", "Notes": "__ignore__",
};

const MESSY_ROWS = [
  { "Item Code": "GLS-4MM", "Desc": "Glass 4mm", "QTY": 180, "Cost": 45000, "Cat": "Glass", "Notes": "good" },
  { "Item Code": "GLS-5MM", "Desc": "Glass 5mm", "QTY": 100, "Cost": 65000, "Cat": "Glass", "Notes": "" },
  { "Item Code": "", "Desc": "", "QTY": "", "Cost": "", "Cat": "", "Notes": "" },            // empty — skip
  { "Item Code": "CMT-50", "Desc": "Cement", "QTY": "five hundred", "Cost": 18000, "Cat": "Cement", "Notes": "" }, // bad qty
  { "Item Code": "RBR-10", "Desc": "Rebar", "QTY": 200, "Cost": -500, "Cat": "Rebar", "Notes": "" },              // negative cost
  { "Item Code": "TLS-001", "Desc": "Drill", "QTY": 25, "Cost": 35000, "Cat": "Tools", "Notes": "ok" },
  { "Item Code": "gls-low", "Desc": "lowercase sku", "QTY": 10, "Cost": 100, "Cat": "", "Notes": "" },             // bad SKU
  { "Item Code": "ALU-001", "Desc": "Aluminum", "QTY": 50, "Cost": 28000, "Cat": "Aluminum", "Notes": "" },
  { "Item Code": null, "Desc": null, "QTY": null, "Cost": null, "Cat": null, "Notes": null },  // null row — skip
  { "Item Code": "MRR-001", "Desc": "Mirror", "QTY": 30, "Cost": 55000, "Cat": "Glass", "Notes": "" },
  { "Item Code": "SCR-100", "Desc": "Screws box", "QTY": 1000, "Cost": 5000, "Cat": "Hardware", "Notes": "" },
  { "Item Code": "GLS-8MM", "Desc": "Glass 8mm", "QTY": "=B2*2", "Cost": 80000, "Cat": "Glass", "Notes": "" },     // formula
  { "Item Code": "SIL-001", "Desc": "Silicone", "QTY": 75, "Cost": 15000, "Cat": "Adhesives", "Notes": "" },
  { "Item Code": "PLY-18", "Desc": "Plywood", "QTY": 40, "Cost": 42000, "Cat": "Wood", "Notes": "" },
  { "Item Code": "NLS-001", "Desc": "Nails 2in", "QTY": 2000, "Cost": "#REF!", "Cat": "Hardware", "Notes": "" },   // formula error
  { "Item Code": "PNT-WHT", "Desc": "Paint white", "QTY": 60, "Cost": 22000, "Cat": "Paint", "Notes": "" },
  { "Item Code": "GLS-10", "Desc": "Glass 10mm", "QTY": 15, "Cost": 95000, "Cat": "Glass", "Notes": "" },
  { "Item Code": "A 001", "Desc": "Space in SKU", "QTY": 5, "Cost": 1000, "Cat": "", "Notes": "" },                // space in SKU
  { "Item Code": "HNG-001", "Desc": "Hinges", "QTY": 150, "Cost": 8000, "Cat": "Hardware", "Notes": "" },
  { "Item Code": "BLT-M10", "Desc": "Bolts M10", "QTY": 300, "Cost": 3000, "Cat": "Hardware", "Notes": "" },
];

test("messy 20 rows: count valid/error/skipped correctly", () => {
  const r = processExcel(MESSY_ROWS, MESSY_MAPPING, RULES);
  eq(r.total, 20);
  eq(r.skipped, 2); // rows 3 and 9 (empty/null)
  // Bad rows: 4 (bad qty), 5 (neg cost), 7 (bad sku), 12 (formula), 15 (formula), 18 (space sku)
  eq(r.errors, 6);
  eq(r.valid, 12); // 20 - 2 skipped - 6 errors = 12
  eq(r.valid + r.errors + r.skipped, r.total);
});

test("messy: Notes column ignored (no data leaks)", () => {
  const mapped = applyMapping(MESSY_ROWS[0], MESSY_MAPPING);
  eq(mapped["Notes"], undefined);
  eq(mapped["__ignore__"], undefined);
});

test("messy: error log row numbers are 1-indexed (human readable)", () => {
  const r = processExcel(MESSY_ROWS, MESSY_MAPPING, RULES);
  // First error is row 4 (index 3, but 1-indexed = 4)
  eq(r.errorLog[0].row, 4);
});

// ═══════════════════════════════════════════════════════════════════════════
// MAPPING EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Mapping Edge Cases ===");

test("unmapped column = data not passed through", () => {
  const mapping: Mapping = { "SKU": "sku", "Name": "" }; // Name unmapped
  const row = { "SKU": "A-001", "Name": "Test" };
  const mapped = applyMapping(row, mapping);
  eq(mapped["name"], undefined);
  eq(mapped["sku"], "A-001");
});

test("all columns ignored = empty mapped row", () => {
  const mapping: Mapping = { "A": "__ignore__", "B": "__ignore__" };
  const row = { "A": "x", "B": "y" };
  const mapped = applyMapping(row, mapping);
  eq(Object.keys(mapped).length, 0);
});

test("same FLUX field mapped twice = last wins (prevented in UI but test engine)", () => {
  // UI prevents this via disabled options, but if somehow both map to sku:
  const mapping: Mapping = { "Code1": "sku", "Code2": "sku" };
  const row = { "Code1": "A-001", "Code2": "B-002" };
  const mapped = applyMapping(row, mapping);
  // Both write to sku — last one wins
  eq(mapped["sku"], "B-002");
});

test("column name with special chars maps fine", () => {
  const mapping: Mapping = { "Price ($)": "cost", "Qty (#)": "stock" };
  const row = { "Price ($)": 45000, "Qty (#)": 180 };
  const mapped = applyMapping(row, mapping);
  eq(mapped["cost"], 45000);
  eq(mapped["stock"], 180);
});

test("column name with quotes maps fine", () => {
  const mapping: Mapping = { 'Item "Name"': "name" };
  const row = { 'Item "Name"': "Glass 4mm" };
  const mapped = applyMapping(row, mapping);
  eq(mapped["name"], "Glass 4mm");
});

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY STATS VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Stats Always Consistent ===");

test("valid + errors + skipped = total (always)", () => {
  const testSets = [GOOD_ROWS, CORRUPT_ROWS_1, CORRUPT_ROWS_2, FORMULA_ROWS, BAD_SKU_ROWS, EMPTY_SCATTERED, OVERFLOW_ROWS, MESSY_ROWS];
  const testMappings = [GOOD_MAPPING, GOOD_MAPPING, GOOD_MAPPING, GOOD_MAPPING, GOOD_MAPPING, GOOD_MAPPING, GOOD_MAPPING, MESSY_MAPPING];
  for (let i = 0; i < testSets.length; i++) {
    const r = processExcel(testSets[i], testMappings[i], RULES);
    eq(r.valid + r.errors + r.skipped, r.total, `set ${i}: ${r.valid}+${r.errors}+${r.skipped} != ${r.total}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${P + F} tests, ${P} passed, ${F} failed`);
if (F > 0) process.exit(1);
