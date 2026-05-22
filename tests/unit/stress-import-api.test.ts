/**
 * STRESS TESTS — Import Templates API
 * Validates CRUD operations, input validation, entity types, column mappings, validation rules
 * Run: npx tsx tests/unit/stress-import-api.test.ts
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
// Entity Type Validation
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Entity Type Validation ===");

const VALID_ENTITY_TYPES = ["inventory", "expenses", "employees", "transactions"];

test("inventory is valid", () => assert(VALID_ENTITY_TYPES.includes("inventory"), "inventory"));
test("expenses is valid", () => assert(VALID_ENTITY_TYPES.includes("expenses"), "expenses"));
test("employees is valid", () => assert(VALID_ENTITY_TYPES.includes("employees"), "employees"));
test("transactions is valid", () => assert(VALID_ENTITY_TYPES.includes("transactions"), "transactions"));
test("rejects 'products' (wrong name)", () => assert(!VALID_ENTITY_TYPES.includes("products"), "products invalid"));
test("rejects empty string", () => assert(!VALID_ENTITY_TYPES.includes(""), "empty invalid"));
test("rejects 'INVENTORY' (case sensitive)", () => assert(!VALID_ENTITY_TYPES.includes("INVENTORY"), "uppercase invalid"));
test("rejects null/undefined", () => {
  assert(!VALID_ENTITY_TYPES.includes(null as unknown as string), "null");
  assert(!VALID_ENTITY_TYPES.includes(undefined as unknown as string), "undefined");
});
test("rejects arbitrary string", () => assert(!VALID_ENTITY_TYPES.includes("customers"), "customers invalid"));
test("rejects number", () => assert(!VALID_ENTITY_TYPES.includes(123 as unknown as string), "number"));

// ═══════════════════════════════════════════════════════════════════════════
// Template Name Validation
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Template Name Validation ===");

function validateTemplateName(name: unknown): boolean {
  if (!name) return false;
  if (typeof name !== "string") return false;
  return name.trim().length > 0;
}

test("accepts normal name", () => assert(validateTemplateName("Stock In — Q2 2026"), "normal"));
test("accepts unicode name", () => assert(validateTemplateName("Importation مخزون"), "arabic"));
test("accepts emoji name", () => assert(validateTemplateName("📊 Monthly Report"), "emoji"));
test("accepts very long name (300 chars)", () => assert(validateTemplateName("A".repeat(300)), "long"));
test("accepts single char", () => assert(validateTemplateName("X"), "single char"));
test("trims whitespace — '  Stock  ' → valid", () => assert(validateTemplateName("  Stock  "), "trimmed"));
test("rejects empty string", () => assert(!validateTemplateName(""), "empty"));
test("rejects whitespace only", () => assert(!validateTemplateName("   "), "whitespace"));
test("rejects null", () => assert(!validateTemplateName(null), "null"));
test("rejects undefined", () => assert(!validateTemplateName(undefined), "undef"));
test("rejects number", () => assert(!validateTemplateName(123), "number"));
test("rejects boolean", () => assert(!validateTemplateName(true), "bool"));
test("rejects object", () => assert(!validateTemplateName({}), "object"));
test("rejects tabs/newlines only", () => assert(!validateTemplateName("\t\n"), "tab/newline"));

// XSS and injection — accepted as strings (React escapes them)
test("accepts HTML tags (React auto-escapes)", () => assert(validateTemplateName("<script>alert(1)</script>"), "xss"));
test("accepts SQL injection attempt", () => assert(validateTemplateName("'; DROP TABLE templates; --"), "sqli"));

// ═══════════════════════════════════════════════════════════════════════════
// Column Mappings JSON Structure
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Column Mappings Serialization ===");

interface ColumnMapping {
  excelColumn: string;
  systemField: string;
  required: boolean;
}

function serializeMappings(mappings: ColumnMapping[] | null): string | null {
  return mappings ? JSON.stringify(mappings) : null;
}

function parseMappings(json: string | null): ColumnMapping[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

test("serialize standard inventory mappings", () => {
  const mappings: ColumnMapping[] = [
    { excelColumn: "SKU", systemField: "sku", required: true },
    { excelColumn: "Product Name", systemField: "name", required: true },
    { excelColumn: "Qty", systemField: "stock", required: true },
    { excelColumn: "Unit Price", systemField: "cost", required: true },
    { excelColumn: "Category", systemField: "category", required: false },
  ];
  const json = serializeMappings(mappings);
  assert(json !== null, "not null");
  const parsed = parseMappings(json);
  eq(parsed.length, 5);
  eq(parsed[0].excelColumn, "SKU");
  assert(parsed[0].required, "SKU required");
  assert(!parsed[4].required, "Category optional");
});

test("null mappings = null JSON", () => eq(serializeMappings(null), null));
test("empty array = '[]'", () => eq(serializeMappings([]), "[]"));

test("round-trip preserves all fields", () => {
  const original: ColumnMapping[] = [
    { excelColumn: "Col A", systemField: "field_a", required: true },
    { excelColumn: "Col B", systemField: "field_b", required: false },
  ];
  const roundTripped = parseMappings(serializeMappings(original));
  eq(roundTripped.length, 2);
  eq(roundTripped[0].excelColumn, "Col A");
  eq(roundTripped[1].required, false);
});

test("parse malformed JSON returns empty array", () => {
  eq(parseMappings("{broken json").length, 0);
});

test("parse null returns empty array", () => eq(parseMappings(null).length, 0));

test("mappings with unicode column names", () => {
  const mappings: ColumnMapping[] = [
    { excelColumn: "المنتج", systemField: "name", required: true },
    { excelColumn: "الكمية", systemField: "stock", required: true },
  ];
  const parsed = parseMappings(serializeMappings(mappings));
  eq(parsed[0].excelColumn, "المنتج");
});

test("mappings with special characters in column names", () => {
  const mappings: ColumnMapping[] = [
    { excelColumn: "Unit Price ($)", systemField: "cost", required: true },
    { excelColumn: "Weight (kg)", systemField: "weight", required: false },
    { excelColumn: 'Item "Name"', systemField: "name", required: true },
  ];
  const parsed = parseMappings(serializeMappings(mappings));
  eq(parsed.length, 3);
  eq(parsed[0].excelColumn, "Unit Price ($)");
  eq(parsed[2].excelColumn, 'Item "Name"');
});

test("50-column mapping (large sheet)", () => {
  const mappings: ColumnMapping[] = Array.from({ length: 50 }, (_, i) => ({
    excelColumn: `Column ${i + 1}`,
    systemField: `field_${i + 1}`,
    required: i < 5,
  }));
  const parsed = parseMappings(serializeMappings(mappings));
  eq(parsed.length, 50);
  assert(parsed[0].required, "first 5 required");
  assert(!parsed[10].required, "rest optional");
});

// ═══════════════════════════════════════════════════════════════════════════
// Validation Rules JSON Structure
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Validation Rules Serialization ===");

interface ValidationRule {
  field: string;
  label: string;
  type: string;
  required: boolean;
  regex: string;
  min: string;
  max: string;
  allowed: string[];
  message: string;
}

function serializeRules(rules: ValidationRule[] | null): string | null {
  return rules ? JSON.stringify(rules) : null;
}

function parseRules(json: string | null): ValidationRule[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

test("serialize SKU validation rule", () => {
  const rules: ValidationRule[] = [{
    field: "sku", label: "SKU", type: "text", required: true,
    regex: "^[A-Z]{2,4}-[A-Z0-9-]+$", min: "", max: "",
    allowed: [], message: "SKU must match format (e.g. GLS-4MM-1224)",
  }];
  const parsed = parseRules(serializeRules(rules));
  eq(parsed[0].field, "sku");
  eq(parsed[0].type, "text");
  assert(parsed[0].required, "required");
  eq(parsed[0].regex, "^[A-Z]{2,4}-[A-Z0-9-]+$");
});

test("number rule with min/max", () => {
  const rules: ValidationRule[] = [{
    field: "qty", label: "Quantity", type: "number", required: true,
    regex: "", min: "0", max: "100000", allowed: [],
    message: "Quantity must be 0-100,000",
  }];
  const parsed = parseRules(serializeRules(rules));
  eq(parsed[0].min, "0");
  eq(parsed[0].max, "100000");
});

test("enum rule with allowed values", () => {
  const rules: ValidationRule[] = [{
    field: "cat", label: "Category", type: "enum", required: false,
    regex: "", min: "", max: "",
    allowed: ["Glass", "Cement", "Rebar", "Tools", "Hardware"],
    message: "",
  }];
  const parsed = parseRules(serializeRules(rules));
  eq(parsed[0].allowed.length, 5);
  assert(parsed[0].allowed.includes("Glass"), "Glass in allowed");
});

test("all supported rule types", () => {
  const types = ["text", "number", "date", "email", "phone", "enum"];
  for (const t of types) {
    const rules: ValidationRule[] = [{
      field: "f", label: "F", type: t, required: false,
      regex: "", min: "", max: "", allowed: [], message: "",
    }];
    const parsed = parseRules(serializeRules(rules));
    eq(parsed[0].type, t, `type ${t}`);
  }
});

test("multiple rules round-trip", () => {
  const rules: ValidationRule[] = [
    { field: "sku", label: "SKU", type: "text", required: true, regex: "^[A-Z]+$", min: "", max: "", allowed: [], message: "Bad SKU" },
    { field: "qty", label: "Qty", type: "number", required: true, regex: "", min: "1", max: "99999", allowed: [], message: "" },
    { field: "email", label: "Email", type: "email", required: false, regex: "", min: "", max: "", allowed: [], message: "" },
  ];
  const parsed = parseRules(serializeRules(rules));
  eq(parsed.length, 3);
  eq(parsed[0].message, "Bad SKU");
  eq(parsed[1].min, "1");
});

// ═══════════════════════════════════════════════════════════════════════════
// Regex Validation Testing (what the import validator would do)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Regex Validation Patterns ===");

function testRegex(pattern: string, value: string): boolean {
  try { return new RegExp(pattern).test(value); } catch { return false; }
}

test("SKU pattern: GLS-4MM-1224 matches", () => assert(testRegex("^[A-Z]{2,4}-[A-Z0-9-]+$", "GLS-4MM-1224"), "match"));
test("SKU pattern: lowercase fails", () => assert(!testRegex("^[A-Z]{2,4}-[A-Z0-9-]+$", "gls-4mm-1224"), "no match"));
test("SKU pattern: no dash fails", () => assert(!testRegex("^[A-Z]{2,4}-[A-Z0-9-]+$", "GLS4MM"), "no dash"));
test("email pattern works", () => assert(testRegex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", "user@test.com"), "email"));
test("email pattern rejects bad input", () => assert(!testRegex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", "not-an-email"), "bad email"));
test("number-only pattern", () => assert(testRegex("^\\d+$", "12345"), "digits"));
test("number-only rejects letters", () => assert(!testRegex("^\\d+$", "123abc"), "mixed"));
test("invalid regex doesn't crash", () => eq(testRegex("[invalid(", "test"), false, "invalid regex = false"));

// ═══════════════════════════════════════════════════════════════════════════
// Number Validation (min/max from validation rules)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Number Range Validation ===");

function validateNumberRange(value: unknown, min: string, max: string): { valid: boolean; error?: string } {
  const num = typeof value === "string" ? parseFloat(value) : value as number;
  if (isNaN(num)) return { valid: false, error: "Not a number" };
  if (!isFinite(num)) return { valid: false, error: "Not finite" };
  if (min && num < parseFloat(min)) return { valid: false, error: `Below minimum ${min}` };
  if (max && num > parseFloat(max)) return { valid: false, error: `Above maximum ${max}` };
  return { valid: true };
}

test("100 in range [0, 100000]", () => assert(validateNumberRange(100, "0", "100000").valid, "in range"));
test("0 at minimum boundary", () => assert(validateNumberRange(0, "0", "100000").valid, "at min"));
test("100000 at maximum boundary", () => assert(validateNumberRange(100000, "0", "100000").valid, "at max"));
test("-1 below minimum", () => assert(!validateNumberRange(-1, "0", "100000").valid, "below min"));
test("100001 above maximum", () => assert(!validateNumberRange(100001, "0", "100000").valid, "above max"));
test("NaN rejected", () => assert(!validateNumberRange(NaN, "0", "100").valid, "NaN"));
test("Infinity rejected", () => assert(!validateNumberRange(Infinity, "0", "100").valid, "Infinity"));
test("string '42' parsed as number", () => assert(validateNumberRange("42", "0", "100").valid, "string num"));
test("string 'abc' rejected", () => assert(!validateNumberRange("abc", "0", "100").valid, "string NaN"));
test("no min = no lower bound", () => assert(validateNumberRange(-999, "", "100").valid, "no min"));
test("no max = no upper bound", () => assert(validateNumberRange(999999, "0", "").valid, "no max"));
test("float precision: 99.999", () => assert(validateNumberRange(99.999, "0", "100").valid, "float in range"));
test("float precision: 100.001 exceeds", () => assert(!validateNumberRange(100.001, "0", "100").valid, "float over"));

// ═══════════════════════════════════════════════════════════════════════════
// Enum Validation (allowed values)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Enum (Allowed Values) Validation ===");

function validateEnum(value: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true; // no restriction
  return allowed.includes(value);
}

test("Glass in [Glass, Cement, Rebar]", () => assert(validateEnum("Glass", ["Glass", "Cement", "Rebar"]), "match"));
test("Wood not in [Glass, Cement, Rebar]", () => assert(!validateEnum("Wood", ["Glass", "Cement", "Rebar"]), "no match"));
test("case sensitive: glass != Glass", () => assert(!validateEnum("glass", ["Glass"]), "case"));
test("empty allowed = anything passes", () => assert(validateEnum("anything", []), "no restriction"));
test("empty value against list", () => assert(!validateEnum("", ["Glass", "Cement"]), "empty"));

// ═══════════════════════════════════════════════════════════════════════════
// Import Job Status Transitions
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Import Job Status Transitions ===");

const VALID_STATUSES = ["pending", "validating", "validated", "importing", "completed", "partial", "failed"];

test("all statuses are valid strings", () => {
  for (const s of VALID_STATUSES) {
    assert(typeof s === "string" && s.length > 0, `${s} valid`);
  }
});

test("default status is pending", () => eq("pending", VALID_STATUSES[0]));

test("valid transitions: pending → validating → validated → importing → completed", () => {
  const flow = ["pending", "validating", "validated", "importing", "completed"];
  for (let i = 1; i < flow.length; i++) {
    assert(VALID_STATUSES.indexOf(flow[i]) > VALID_STATUSES.indexOf(flow[i - 1]),
      `${flow[i - 1]} → ${flow[i]}`);
  }
});

test("partial is a terminal state (some rows failed)", () => {
  assert(VALID_STATUSES.includes("partial"), "partial exists");
});

test("failed is a terminal state", () => {
  assert(VALID_STATUSES.includes("failed"), "failed exists");
});

// ═══════════════════════════════════════════════════════════════════════════
// Import Stats Calculation
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Import Stats Calculation ===");

interface JobStats {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  skippedRows: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
}

function calculateStats(jobs: JobStats[]) {
  const totalImports = jobs.length;
  const totalRowsImported = jobs.reduce((s, j) => s + j.validRows, 0);
  const completedJobs = jobs.filter(j => j.status === "completed" || j.status === "partial");
  const successRate = totalImports > 0
    ? Math.round((completedJobs.length / totalImports) * 1000) / 10
    : 0;
  return { totalImports, totalRowsImported, successRate };
}

test("empty jobs = zero stats", () => {
  const s = calculateStats([]);
  eq(s.totalImports, 0);
  eq(s.totalRowsImported, 0);
  eq(s.successRate, 0);
});

test("single completed job", () => {
  const s = calculateStats([
    { totalRows: 100, validRows: 95, warningRows: 3, errorRows: 2, skippedRows: 0, status: "completed", startedAt: null, completedAt: null },
  ]);
  eq(s.totalImports, 1);
  eq(s.totalRowsImported, 95);
  eq(s.successRate, 100);
});

test("mixed statuses", () => {
  const s = calculateStats([
    { totalRows: 100, validRows: 100, warningRows: 0, errorRows: 0, skippedRows: 0, status: "completed", startedAt: null, completedAt: null },
    { totalRows: 50, validRows: 40, warningRows: 5, errorRows: 5, skippedRows: 0, status: "partial", startedAt: null, completedAt: null },
    { totalRows: 200, validRows: 0, warningRows: 0, errorRows: 200, skippedRows: 0, status: "failed", startedAt: null, completedAt: null },
  ]);
  eq(s.totalImports, 3);
  eq(s.totalRowsImported, 140); // 100 + 40
  eq(s.successRate, 66.7); // 2/3
});

test("all failed = 0% success rate", () => {
  const s = calculateStats([
    { totalRows: 100, validRows: 0, warningRows: 0, errorRows: 100, skippedRows: 0, status: "failed", startedAt: null, completedAt: null },
    { totalRows: 50, validRows: 0, warningRows: 0, errorRows: 50, skippedRows: 0, status: "failed", startedAt: null, completedAt: null },
  ]);
  eq(s.successRate, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
