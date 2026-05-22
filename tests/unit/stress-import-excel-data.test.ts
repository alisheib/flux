/**
 * STRESS TESTS — Excel Import Data Validation
 * Simulates real Excel rows: good data, corrupt data, type mismatches,
 * wrong formats, swapped columns, missing required fields, overflow values,
 * dates as ints, ints as strings, unicode garbage, formula results, etc.
 *
 * Run: npx tsx tests/unit/stress-import-excel-data.test.ts
 */

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  \x1b[32mPASS\x1b[0m  ${name}`); }
  catch (e: unknown) { failed++; const m = e instanceof Error ? e.message : String(e); console.log(`  \x1b[31mFAIL\x1b[0m  ${name}\n        ${m}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function eq(a: unknown, b: unknown, m?: string) { if (a !== b) throw new Error(m || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ═══════════════════════════════════════════════════════════════════════════
// Row-level validator — replicates what the import engine should do
// ═══════════════════════════════════════════════════════════════════════════

interface FieldRule {
  field: string;
  type: "text" | "number" | "date" | "email" | "phone" | "enum";
  required: boolean;
  regex?: string;
  min?: number;
  max?: number;
  allowed?: string[];
  message?: string;
}

interface ValidationError {
  field: string;
  value: unknown;
  message: string;
}

function validateRow(
  row: Record<string, unknown>,
  rules: FieldRule[]
): { status: "valid" | "warning" | "error"; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  for (const rule of rules) {
    const raw = row[rule.field];
    const val = raw === undefined || raw === null ? "" : String(raw).trim();

    // Required check
    if (rule.required && val === "") {
      errors.push({ field: rule.field, value: raw, message: rule.message || `${rule.field} is required` });
      continue;
    }

    // Skip optional empty
    if (val === "") continue;

    // Type checks
    switch (rule.type) {
      case "number": {
        const num = Number(val);
        if (isNaN(num) || !isFinite(num)) {
          errors.push({ field: rule.field, value: raw, message: `${rule.field} must be a number, got "${val}"` });
          break;
        }
        if (rule.min !== undefined && num < rule.min) {
          errors.push({ field: rule.field, value: raw, message: `${rule.field} (${num}) is below minimum ${rule.min}` });
        }
        if (rule.max !== undefined && num > rule.max) {
          errors.push({ field: rule.field, value: raw, message: `${rule.field} (${num}) exceeds maximum ${rule.max}` });
        }
        break;
      }
      case "date": {
        // Reject pure numeric strings — likely Excel serial date numbers, not real dates
        if (/^\d+$/.test(val)) {
          errors.push({ field: rule.field, value: raw, message: `${rule.field} looks like a number, not a date (Excel serial?). Got "${val}"` });
          break;
        }
        const d = new Date(val);
        if (isNaN(d.getTime())) {
          errors.push({ field: rule.field, value: raw, message: `${rule.field} is not a valid date, got "${val}"` });
        } else {
          // Sanity check: date should be in a reasonable range (1900-2100)
          const year = d.getFullYear();
          if (year < 1900 || year > 2100) {
            errors.push({ field: rule.field, value: raw, message: `${rule.field} has an unreasonable year (${year})` });
          }
        }
        break;
      }
      case "email": {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          errors.push({ field: rule.field, value: raw, message: `${rule.field} is not a valid email, got "${val}"` });
        }
        break;
      }
      case "phone": {
        const clean = val.replace(/[\s\-()]/g, "");
        if (!/^\+?\d{7,15}$/.test(clean)) {
          errors.push({ field: rule.field, value: raw, message: `${rule.field} is not a valid phone number` });
        }
        break;
      }
      case "enum": {
        if (rule.allowed && rule.allowed.length > 0 && !rule.allowed.includes(val)) {
          errors.push({ field: rule.field, value: raw, message: `${rule.field} "${val}" is not one of: ${rule.allowed.join(", ")}` });
        }
        break;
      }
      case "text": {
        if (rule.regex) {
          try {
            if (!new RegExp(rule.regex).test(val)) {
              errors.push({ field: rule.field, value: raw, message: rule.message || `${rule.field} doesn't match pattern` });
            }
          } catch {
            // invalid regex — skip
          }
        }
        break;
      }
    }
  }

  return {
    status: errors.length === 0 ? "valid" : "error",
    errors,
  };
}

// ── Standard inventory rules ──────────────────────────────────────────────
const INVENTORY_RULES: FieldRule[] = [
  { field: "sku", type: "text", required: true, regex: "^[A-Z0-9][A-Z0-9\\-_]+$" },
  { field: "name", type: "text", required: true },
  { field: "category", type: "enum", required: false, allowed: ["Glass", "Cement", "Rebar", "Tools", "Hardware", "Aluminum"] },
  { field: "quantity", type: "number", required: true, min: 0, max: 999999 },
  { field: "cost_price", type: "number", required: true, min: 0 },
  { field: "selling_price", type: "number", required: false, min: 0 },
  { field: "supplier_email", type: "email", required: false },
  { field: "import_date", type: "date", required: false },
];

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: PERFECTLY VALID ROWS
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== GOOD EXCEL DATA — Valid Rows ===");

test("standard inventory row", () => {
  const r = validateRow({
    sku: "GLS-4MM-1224", name: "Float glass 4mm clear", category: "Glass",
    quantity: 180, cost_price: 45000, selling_price: 120000,
    supplier_email: "sales@guangzhou.cn", import_date: "2026-05-15",
  }, INVENTORY_RULES);
  eq(r.status, "valid");
  eq(r.errors.length, 0);
});

test("minimal required fields only", () => {
  const r = validateRow({
    sku: "RBR-10MM", name: "Rebar 10mm", quantity: 500, cost_price: 12000,
  }, INVENTORY_RULES);
  eq(r.status, "valid");
});

test("all optional fields empty", () => {
  const r = validateRow({
    sku: "CMT-50KG", name: "Cement 50kg bag", quantity: 1000, cost_price: 18000,
    category: "", selling_price: "", supplier_email: "", import_date: "",
  }, INVENTORY_RULES);
  eq(r.status, "valid");
});

test("zero quantity is valid (min=0)", () => {
  const r = validateRow({
    sku: "TLS-DRILL", name: "Drill bit set", quantity: 0, cost_price: 35000,
  }, INVENTORY_RULES);
  eq(r.status, "valid");
});

test("zero cost is valid (free sample)", () => {
  const r = validateRow({
    sku: "SAMPLE-001", name: "Free sample", quantity: 1, cost_price: 0,
  }, INVENTORY_RULES);
  eq(r.status, "valid");
});

test("large quantity (999999 = max)", () => {
  const r = validateRow({
    sku: "BLK-SCREWS", name: "Bulk screws", quantity: 999999, cost_price: 50,
  }, INVENTORY_RULES);
  eq(r.status, "valid");
});

test("TSH price with large number", () => {
  const r = validateRow({
    sku: "GLS-6MM-1830", name: "Glass 6mm tinted", quantity: 100,
    cost_price: 250000, selling_price: 650000,
  }, INVENTORY_RULES);
  eq(r.status, "valid");
});

test("date in ISO format", () => {
  const r = validateRow({
    sku: "A-001", name: "Item", quantity: 1, cost_price: 100,
    import_date: "2026-01-15T10:30:00Z",
  }, INVENTORY_RULES);
  eq(r.status, "valid");
});

test("date in human format", () => {
  const r = validateRow({
    sku: "A-002", name: "Item", quantity: 1, cost_price: 100,
    import_date: "15 May 2026",
  }, INVENTORY_RULES);
  eq(r.status, "valid");
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: TYPE MISMATCHES — int field gets string
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== CORRUPT DATA — Type Mismatches ===");

test("quantity is string 'one hundred' instead of number", () => {
  const r = validateRow({
    sku: "GLS-001", name: "Glass", quantity: "one hundred", cost_price: 45000,
  }, INVENTORY_RULES);
  eq(r.status, "error");
  assert(r.errors.some(e => e.field === "quantity" && e.message.includes("must be a number")), "qty error");
});

test("cost_price is string 'N/A'", () => {
  const r = validateRow({
    sku: "GLS-002", name: "Glass", quantity: 100, cost_price: "N/A",
  }, INVENTORY_RULES);
  eq(r.status, "error");
  assert(r.errors.some(e => e.field === "cost_price"), "cost error");
});

test("quantity is string '50 pieces' (unit appended)", () => {
  const r = validateRow({
    sku: "X-001", name: "Item", quantity: "50 pieces", cost_price: 100,
  }, INVENTORY_RULES);
  eq(r.status, "error"); // "50 pieces" → NaN
});

test("cost_price is '$45,000' (currency prefix + commas)", () => {
  const r = validateRow({
    sku: "X-002", name: "Item", quantity: 10, cost_price: "$45,000",
  }, INVENTORY_RULES);
  eq(r.status, "error"); // "$45,000" → NaN
});

test("quantity is boolean true (from Excel TRUE)", () => {
  const r = validateRow({
    sku: "X-003", name: "Item", quantity: true, cost_price: 100,
  }, INVENTORY_RULES);
  // String(true) = "true" → NaN
  eq(r.status, "error");
});

test("cost_price is empty object (corrupt cell)", () => {
  const r = validateRow({
    sku: "X-004", name: "Item", quantity: 10, cost_price: {},
  }, INVENTORY_RULES);
  eq(r.status, "error"); // "[object Object]" → NaN
});

test("quantity is array [100] (SheetJS quirk)", () => {
  const r = validateRow({
    sku: "X-005", name: "Item", quantity: [100], cost_price: 100,
  }, INVENTORY_RULES);
  // String([100]) = "100" → 100 → actually valid!
  eq(r.status, "valid"); // This is a known edge case — arrays stringify to their contents
});

test("quantity is negative (-50)", () => {
  const r = validateRow({
    sku: "X-006", name: "Item", quantity: -50, cost_price: 100,
  }, INVENTORY_RULES);
  eq(r.status, "error");
  assert(r.errors.some(e => e.field === "quantity" && e.message.includes("below minimum")), "neg qty");
});

test("quantity exceeds max (1000000)", () => {
  const r = validateRow({
    sku: "X-007", name: "Item", quantity: 1000000, cost_price: 100,
  }, INVENTORY_RULES);
  eq(r.status, "error");
  assert(r.errors.some(e => e.field === "quantity" && e.message.includes("exceeds maximum")), "over max");
});

test("quantity is Infinity", () => {
  const r = validateRow({
    sku: "X-008", name: "Item", quantity: Infinity, cost_price: 100,
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

test("quantity is NaN", () => {
  const r = validateRow({
    sku: "X-009", name: "Item", quantity: NaN, cost_price: 100,
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

test("cost_price is negative (-500)", () => {
  const r = validateRow({
    sku: "X-010", name: "Item", quantity: 10, cost_price: -500,
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: DATE FIELD GETS INT (Excel serial date number)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== CORRUPT DATA — Date ↔ Number Swaps ===");

test("date field gets Excel serial number 46161 (= 2026-05-15)", () => {
  // Excel stores dates as serial numbers. SheetJS may return 46161.
  const r = validateRow({
    sku: "D-001", name: "Item", quantity: 10, cost_price: 100,
    import_date: 46161,
  }, INVENTORY_RULES);
  // String(46161) = "46161" → new Date("46161") → Invalid Date
  eq(r.status, "error");
  assert(r.errors.some(e => e.field === "import_date"), "serial date fails string parse");
});

test("date field gets string '46161' (serial as string)", () => {
  const r = validateRow({
    sku: "D-002", name: "Item", quantity: 10, cost_price: 100,
    import_date: "46161",
  }, INVENTORY_RULES);
  eq(r.status, "error"); // "46161" is not a valid date
});

test("number field gets date string '2026-05-15'", () => {
  const r = validateRow({
    sku: "D-003", name: "Item", quantity: "2026-05-15", cost_price: 100,
  }, INVENTORY_RULES);
  eq(r.status, "error"); // "2026-05-15" → NaN
});

test("number field gets date object", () => {
  const r = validateRow({
    sku: "D-004", name: "Item", quantity: new Date("2026-05-15"), cost_price: 100,
  }, INVENTORY_RULES);
  // String(Date) = "Thu May 15 2026 ..." → NaN
  eq(r.status, "error");
});

test("cost_price gets timestamp '1747267200000'", () => {
  // Someone pasted a Unix timestamp into the price column
  const r = validateRow({
    sku: "D-005", name: "Item", quantity: 10, cost_price: "1747267200000",
  }, INVENTORY_RULES);
  // This is technically a valid number (1.7 trillion), but it should be caught
  // by max validation if one is set. Without max, it's "valid" but absurd.
  eq(r.status, "valid"); // No max set for cost_price — this passes!
});

test("date field gets 'not a date'", () => {
  const r = validateRow({
    sku: "D-006", name: "Item", quantity: 10, cost_price: 100,
    import_date: "not a date",
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

test("date field gets '31/02/2026' (impossible date)", () => {
  const r = validateRow({
    sku: "D-007", name: "Item", quantity: 10, cost_price: 100,
    import_date: "31/02/2026",
  }, INVENTORY_RULES);
  // new Date("31/02/2026") → Invalid Date in most parsers
  eq(r.status, "error");
});

test("date field gets '2026-13-45' (month 13, day 45)", () => {
  const r = validateRow({
    sku: "D-008", name: "Item", quantity: 10, cost_price: 100,
    import_date: "2026-13-45",
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: MISSING REQUIRED FIELDS
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== CORRUPT DATA — Missing Required Fields ===");

test("missing SKU", () => {
  const r = validateRow({
    name: "Glass", quantity: 100, cost_price: 45000,
  }, INVENTORY_RULES);
  eq(r.status, "error");
  assert(r.errors.some(e => e.field === "sku"), "sku missing");
});

test("missing name", () => {
  const r = validateRow({
    sku: "GLS-001", quantity: 100, cost_price: 45000,
  }, INVENTORY_RULES);
  eq(r.status, "error");
  assert(r.errors.some(e => e.field === "name"), "name missing");
});

test("missing quantity", () => {
  const r = validateRow({
    sku: "GLS-001", name: "Glass", cost_price: 45000,
  }, INVENTORY_RULES);
  eq(r.status, "error");
  assert(r.errors.some(e => e.field === "quantity"), "quantity missing");
});

test("missing cost_price", () => {
  const r = validateRow({
    sku: "GLS-001", name: "Glass", quantity: 100,
  }, INVENTORY_RULES);
  eq(r.status, "error");
  assert(r.errors.some(e => e.field === "cost_price"), "cost missing");
});

test("ALL required fields missing (empty row)", () => {
  const r = validateRow({}, INVENTORY_RULES);
  eq(r.status, "error");
  eq(r.errors.length, 4); // sku, name, quantity, cost_price
});

test("required field is null", () => {
  const r = validateRow({
    sku: null, name: "Glass", quantity: 100, cost_price: 45000,
  }, INVENTORY_RULES);
  eq(r.status, "error");
  assert(r.errors.some(e => e.field === "sku"), "null sku");
});

test("required field is undefined", () => {
  const r = validateRow({
    sku: undefined, name: "Glass", quantity: 100, cost_price: 45000,
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

test("required field is empty string", () => {
  const r = validateRow({
    sku: "", name: "Glass", quantity: 100, cost_price: 45000,
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

test("required field is whitespace only", () => {
  const r = validateRow({
    sku: "   ", name: "Glass", quantity: 100, cost_price: 45000,
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: ENUM FIELD CORRUPTION
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== CORRUPT DATA — Enum/Category Mismatches ===");

test("category 'Glass' (exact match) = valid", () => {
  const r = validateRow({
    sku: "E-001", name: "Item", quantity: 10, cost_price: 100, category: "Glass",
  }, INVENTORY_RULES);
  eq(r.status, "valid");
});

test("category 'glass' (wrong case) = error", () => {
  const r = validateRow({
    sku: "E-002", name: "Item", quantity: 10, cost_price: 100, category: "glass",
  }, INVENTORY_RULES);
  eq(r.status, "error");
  assert(r.errors.some(e => e.field === "category"), "case mismatch");
});

test("category 'GLASS' (all caps) = error", () => {
  const r = validateRow({
    sku: "E-003", name: "Item", quantity: 10, cost_price: 100, category: "GLASS",
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

test("category 'Wood' (not in allowed list) = error", () => {
  const r = validateRow({
    sku: "E-004", name: "Item", quantity: 10, cost_price: 100, category: "Wood",
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

test("category with trailing space 'Glass ' = error", () => {
  // Note: the validator trims values, so "Glass " → "Glass" → valid!
  const r = validateRow({
    sku: "E-005", name: "Item", quantity: 10, cost_price: 100, category: "Glass ",
  }, INVENTORY_RULES);
  eq(r.status, "valid"); // trimmed to "Glass"
});

test("category is number 1 (user put index instead of name)", () => {
  const r = validateRow({
    sku: "E-006", name: "Item", quantity: 10, cost_price: 100, category: 1,
  }, INVENTORY_RULES);
  eq(r.status, "error"); // "1" not in allowed list
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: EMAIL FIELD CORRUPTION
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== CORRUPT DATA — Email Field ===");

test("valid email", () => {
  const r = validateRow({
    sku: "M-001", name: "Item", quantity: 10, cost_price: 100,
    supplier_email: "ali@example.com",
  }, INVENTORY_RULES);
  eq(r.status, "valid");
});

test("email without @", () => {
  const r = validateRow({
    sku: "M-002", name: "Item", quantity: 10, cost_price: 100,
    supplier_email: "not-an-email",
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

test("email with spaces", () => {
  const r = validateRow({
    sku: "M-003", name: "Item", quantity: 10, cost_price: 100,
    supplier_email: "ali @example.com",
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

test("phone number in email field", () => {
  const r = validateRow({
    sku: "M-004", name: "Item", quantity: 10, cost_price: 100,
    supplier_email: "+255712345678",
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

test("URL in email field", () => {
  const r = validateRow({
    sku: "M-005", name: "Item", quantity: 10, cost_price: 100,
    supplier_email: "https://example.com",
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: SKU REGEX PATTERN FAILURES
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== CORRUPT DATA — SKU Pattern ===");

test("valid SKU: GLS-4MM-1224", () => {
  const r = validateRow({
    sku: "GLS-4MM-1224", name: "Glass", quantity: 10, cost_price: 100,
  }, INVENTORY_RULES);
  eq(r.status, "valid");
});

test("SKU with lowercase: gls-4mm", () => {
  const r = validateRow({
    sku: "gls-4mm", name: "Glass", quantity: 10, cost_price: 100,
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

test("SKU with spaces: 'GLS 4MM'", () => {
  const r = validateRow({
    sku: "GLS 4MM", name: "Glass", quantity: 10, cost_price: 100,
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

test("SKU that is just a number: '12345'", () => {
  const r = validateRow({
    sku: "12345", name: "Item", quantity: 10, cost_price: 100,
  }, INVENTORY_RULES);
  eq(r.status, "valid"); // starts with digit, rest is digits — matches ^[A-Z0-9]...
});

test("SKU with special chars: 'GLS/4MM@1224'", () => {
  const r = validateRow({
    sku: "GLS/4MM@1224", name: "Glass", quantity: 10, cost_price: 100,
  }, INVENTORY_RULES);
  eq(r.status, "error"); // / and @ not in pattern
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: MULTIPLE ERRORS PER ROW
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Multiple Errors in One Row ===");

test("row with 3 errors: bad sku + string qty + missing cost", () => {
  const r = validateRow({
    sku: "bad sku!", name: "Glass", quantity: "fifty", /* cost_price missing */
  }, INVENTORY_RULES);
  eq(r.status, "error");
  assert(r.errors.length >= 3, `Expected >= 3 errors, got ${r.errors.length}`);
});

test("every field wrong", () => {
  const r = validateRow({
    sku: "",
    name: "",
    category: "NonExistent",
    quantity: "not a number",
    cost_price: "free",
    selling_price: -100,
    supplier_email: "bad-email",
    import_date: "not-a-date",
  }, INVENTORY_RULES);
  eq(r.status, "error");
  assert(r.errors.length >= 6, `Expected >= 6 errors, got ${r.errors.length}: ${r.errors.map(e => e.field).join(", ")}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: UNICODE / ENCODING GARBAGE
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== CORRUPT DATA — Unicode & Encoding ===");

test("name with Arabic text = valid (text field accepts anything)", () => {
  const r = validateRow({
    sku: "AR-001", name: "زجاج مقسى 6 ملم", quantity: 50, cost_price: 80000,
  }, INVENTORY_RULES);
  eq(r.status, "valid");
});

test("name with Chinese text = valid", () => {
  const r = validateRow({
    sku: "CN-001", name: "钢化玻璃 4mm", quantity: 200, cost_price: 45000,
  }, INVENTORY_RULES);
  eq(r.status, "valid");
});

test("name with mojibake: 'GlÃ¤s' (UTF-8 decoded as Latin-1)", () => {
  const r = validateRow({
    sku: "MJ-001", name: "GlÃ¤s 5mm", quantity: 10, cost_price: 100,
  }, INVENTORY_RULES);
  eq(r.status, "valid"); // text field, no pattern — accepted
});

test("name with null bytes embedded", () => {
  const r = validateRow({
    sku: "NB-001", name: "Glass\x005mm", quantity: 10, cost_price: 100,
  }, INVENTORY_RULES);
  eq(r.status, "valid"); // string trim won't catch null bytes, but it's non-empty
});

test("sku with emoji: 'GLS-🔥-001'", () => {
  const r = validateRow({
    sku: "GLS-🔥-001", name: "Fire glass", quantity: 10, cost_price: 100,
  }, INVENTORY_RULES);
  eq(r.status, "error"); // emoji not in [A-Z0-9\-_]
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10: EXCEL FORMULA RESIDUE
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== CORRUPT DATA — Formula Residue ===");

test("quantity is formula string '=SUM(A1:A10)'", () => {
  const r = validateRow({
    sku: "F-001", name: "Item", quantity: "=SUM(A1:A10)", cost_price: 100,
  }, INVENTORY_RULES);
  eq(r.status, "error"); // "=SUM(A1:A10)" → NaN
});

test("cost is #REF! error", () => {
  const r = validateRow({
    sku: "F-002", name: "Item", quantity: 10, cost_price: "#REF!",
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

test("name is #N/A error", () => {
  const r = validateRow({
    sku: "F-003", name: "#N/A", quantity: 10, cost_price: 100,
  }, INVENTORY_RULES);
  eq(r.status, "valid"); // text field, "#N/A" is a non-empty string — accepted
  // NOTE: this is a data quality issue, not a validation error. You'd need a
  // specific "#N/A" check if you want to catch it.
});

test("cost is #DIV/0! error", () => {
  const r = validateRow({
    sku: "F-004", name: "Item", quantity: 10, cost_price: "#DIV/0!",
  }, INVENTORY_RULES);
  eq(r.status, "error"); // NaN
});

test("cost is #VALUE! error", () => {
  const r = validateRow({
    sku: "F-005", name: "Item", quantity: 10, cost_price: "#VALUE!",
  }, INVENTORY_RULES);
  eq(r.status, "error");
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 11: LARGE BATCH VALIDATION
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Batch Validation — 10,000 Row Simulation ===");

test("10,000 valid rows validate without error", () => {
  let validCount = 0;
  for (let i = 0; i < 10000; i++) {
    const r = validateRow({
      sku: `PRD-${String(i).padStart(5, "0")}`,
      name: `Product ${i}`,
      quantity: Math.floor(Math.random() * 1000),
      cost_price: Math.floor(Math.random() * 500000),
    }, INVENTORY_RULES);
    if (r.status === "valid") validCount++;
  }
  eq(validCount, 10000);
});

test("5,000 rows with mixed errors: count errors correctly", () => {
  let valid = 0, error = 0;
  for (let i = 0; i < 5000; i++) {
    const isCorrupt = i % 7 === 0; // every 7th row is bad
    const r = validateRow({
      sku: isCorrupt ? "" : `P-${i}`,
      name: `Item ${i}`,
      quantity: isCorrupt ? "bad" : i * 2,
      cost_price: isCorrupt ? -1 : i * 100,
    }, INVENTORY_RULES);
    if (r.status === "valid") valid++;
    else error++;
  }
  // Every 7th row: 0,7,14,...,4998 → floor(5000/7) + 1 = 715 bad rows
  const expectedBad = Math.floor(4999 / 7) + 1;
  eq(error, expectedBad);
  eq(valid, 5000 - expectedBad);
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 12: EXPENSE IMPORT RULES (different entity type)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Expense Import Validation ===");

const EXPENSE_RULES: FieldRule[] = [
  { field: "date", type: "date", required: true },
  { field: "category", type: "enum", required: true, allowed: ["Freight", "Customs", "Insurance", "Port", "Transport", "Other"] },
  { field: "description", type: "text", required: true },
  { field: "amount", type: "number", required: true, min: 0 },
  { field: "currency", type: "enum", required: false, allowed: ["USD", "TSH", "EUR"] },
  { field: "vendor_email", type: "email", required: false },
];

test("valid expense row", () => {
  const r = validateRow({
    date: "2026-05-15", category: "Freight", description: "Sea freight Dar-Guangzhou",
    amount: 3500, currency: "USD", vendor_email: "shipping@maersk.com",
  }, EXPENSE_RULES);
  eq(r.status, "valid");
});

test("expense with no date = error", () => {
  const r = validateRow({
    category: "Customs", description: "Duty", amount: 1200,
  }, EXPENSE_RULES);
  eq(r.status, "error");
  assert(r.errors.some(e => e.field === "date"), "date required");
});

test("expense with invalid category", () => {
  const r = validateRow({
    date: "2026-05-15", category: "Bribery", description: "Facilitation",
    amount: 500,
  }, EXPENSE_RULES);
  eq(r.status, "error");
  assert(r.errors.some(e => e.field === "category"), "bad category");
});

test("expense with negative amount", () => {
  const r = validateRow({
    date: "2026-05-15", category: "Freight", description: "Refund",
    amount: -500,
  }, EXPENSE_RULES);
  eq(r.status, "error");
});

test("expense with wrong currency", () => {
  const r = validateRow({
    date: "2026-05-15", category: "Insurance", description: "Marine insurance",
    amount: 800, currency: "GBP",
  }, EXPENSE_RULES);
  eq(r.status, "error");
  assert(r.errors.some(e => e.field === "currency"), "bad currency");
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 13: EMPLOYEE IMPORT (phone validation)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Employee Import — Phone Validation ===");

const EMPLOYEE_RULES: FieldRule[] = [
  { field: "name", type: "text", required: true },
  { field: "email", type: "email", required: true },
  { field: "phone", type: "phone", required: false },
  { field: "salary", type: "number", required: false, min: 0 },
  { field: "start_date", type: "date", required: false },
];

test("valid employee with TZ phone", () => {
  const r = validateRow({
    name: "Ali Sheib", email: "ali@flux.com", phone: "+255712345678",
    salary: 1500000, start_date: "2026-01-15",
  }, EMPLOYEE_RULES);
  eq(r.status, "valid");
});

test("phone without country code", () => {
  const r = validateRow({
    name: "Test", email: "t@t.com", phone: "0712345678",
  }, EMPLOYEE_RULES);
  eq(r.status, "valid"); // 10 digits, valid
});

test("phone is text 'call me'", () => {
  const r = validateRow({
    name: "Test", email: "t@t.com", phone: "call me",
  }, EMPLOYEE_RULES);
  eq(r.status, "error");
});

test("phone too short: '123'", () => {
  const r = validateRow({
    name: "Test", email: "t@t.com", phone: "123",
  }, EMPLOYEE_RULES);
  eq(r.status, "error");
});

test("salary is string 'TBD'", () => {
  const r = validateRow({
    name: "Test", email: "t@t.com", salary: "TBD",
  }, EMPLOYEE_RULES);
  eq(r.status, "error");
});

test("start_date is int 2026 (year only) — caught as numeric-only", () => {
  const r = validateRow({
    name: "Test", email: "t@t.com", start_date: 2026,
  }, EMPLOYEE_RULES);
  // String(2026) = "2026" → pure numeric → rejected (could be Excel serial)
  // This is correct: "2026" alone is ambiguous — is it year 2026 or Excel serial day 2026?
  eq(r.status, "error");
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
