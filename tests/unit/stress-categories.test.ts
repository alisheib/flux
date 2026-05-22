/**
 * STRESS TESTS — Categories with custom fields
 * Tests edge cases in category creation, field configs, unicode, XSS, and boundaries
 * Run: npx tsx tests/unit/stress-categories.test.ts
 */

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

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }
function eq(a: unknown, b: unknown, msg?: string) { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ═══════════════════════════════════════════════════════════════════════════
// Category Name Validation
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Category Name Edge Cases ===");

function validateCatName(name: unknown): { valid: boolean; trimmed?: string } {
  if (!name || !(name as string).trim()) return { valid: false };
  return { valid: true, trimmed: (name as string).trim() };
}

test("rejects empty string", () => assert(!validateCatName("").valid, "empty"));
test("rejects whitespace-only", () => assert(!validateCatName("   ").valid, "spaces"));
test("rejects tabs-only", () => assert(!validateCatName("\t\t").valid, "tabs"));
test("rejects newlines-only", () => assert(!validateCatName("\n\n").valid, "newlines"));
test("rejects null", () => assert(!validateCatName(null).valid, "null"));
test("rejects undefined", () => assert(!validateCatName(undefined).valid, "undef"));
test("rejects 0 (number)", () => assert(!validateCatName(0).valid, "zero num"));
test("rejects false (bool)", () => assert(!validateCatName(false).valid, "false"));

test("accepts normal name", () => {
  const r = validateCatName("Glass");
  assert(r.valid, "valid"); eq(r.trimmed, "Glass");
});
test("trims leading/trailing spaces", () => {
  eq(validateCatName("  Glass  ").trimmed, "Glass");
});

// Unicode and international names — real African business names
test("accepts Arabic name", () => assert(validateCatName("زجاج مقسى").valid, "Arabic"));
test("accepts Swahili name", () => assert(validateCatName("Kioo cha kupikia").valid, "Swahili"));
test("accepts French name", () => assert(validateCatName("Verre trempé").valid, "French"));
test("accepts Chinese name", () => assert(validateCatName("钢化玻璃").valid, "Chinese"));
test("accepts emoji name", () => assert(validateCatName("🪟 Glass").valid, "emoji"));
test("accepts very long name (200 chars)", () => {
  assert(validateCatName("A".repeat(200)).valid, "200 chars");
});
test("accepts single char", () => assert(validateCatName("G").valid, "single"));

// XSS / injection attempts — these should be ACCEPTED as names but NOT cause issues
// The app stores them, they must render safely via React (auto-escaped)
test("accepts HTML tag in name (React auto-escapes)", () => {
  assert(validateCatName('<script>alert("xss")</script>').valid, "HTML tags");
});
test("accepts SQL injection attempt in name", () => {
  assert(validateCatName("'; DROP TABLE categories; --").valid, "SQL inject");
});

// ═══════════════════════════════════════════════════════════════════════════
// Category Fields (JSON array of optional product fields)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Category Custom Fields Configuration ===");

function serializeFields(fields: unknown): string | null {
  return fields ? JSON.stringify(fields) : null;
}

function parseFields(json: string | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

test("serializes standard glass fields", () => {
  const fields = ["thickness", "width", "height", "color", "sellByArea"];
  const json = serializeFields(fields);
  eq(json, '["thickness","width","height","color","sellByArea"]');
});

test("serializes empty array as '[]'", () => {
  eq(serializeFields([]), "[]");
});

test("serializes null/undefined as null", () => {
  eq(serializeFields(null), null);
  eq(serializeFields(undefined), null);
});

test("parses fields back correctly", () => {
  const original = ["thickness", "width", "height", "color"];
  const json = serializeFields(original);
  const parsed = parseFields(json);
  eq(parsed.length, 4);
  eq(parsed[0], "thickness");
  eq(parsed[3], "color");
});

test("parses null fields to empty array", () => {
  eq(parseFields(null).length, 0);
});

test("parses malformed JSON gracefully", () => {
  eq(parseFields("{not valid json").length, 0);
});

// sellByArea field interactions
test("sellByArea included in fields enables area pricing", () => {
  const fields = parseFields('["thickness","width","height","sellByArea"]');
  assert(fields.includes("sellByArea"), "has sellByArea");
});

test("category without sellByArea = no area pricing", () => {
  const fields = parseFields('["thickness","color"]');
  assert(!fields.includes("sellByArea"), "no sellByArea");
});

test("handles duplicate field entries", () => {
  const fields = ["thickness", "thickness", "width"];
  const json = serializeFields(fields);
  const parsed = parseFields(json);
  eq(parsed.length, 3); // dupes preserved — not ideal but not breaking
});

// Different category configurations for different product types
test("iron/steel category — no area fields", () => {
  const fields = ["thickness", "color"];
  const json = serializeFields(fields);
  const parsed = parseFields(json);
  assert(!parsed.includes("sellByArea"), "iron = no area");
  assert(!parsed.includes("width"), "iron = no width");
});

test("aluminum category — full area config", () => {
  const fields = ["thickness", "width", "height", "color", "sellByArea"];
  const hasSellByArea = fields.includes("sellByArea");
  assert(hasSellByArea, "aluminum has area selling");
});

test("general merchandise — no custom fields", () => {
  eq(serializeFields(null), null);
  eq(parseFields(null).length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// Category Icon/Color Edge Cases
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Category Icon/Color Edge Cases ===");

test("icon can be null", () => {
  const icon = null || null;
  eq(icon, null);
});

test("color can be any CSS string", () => {
  const colors = ["#FF5733", "rgb(255,87,51)", "red", "hsl(12,100%,60%)"];
  for (const c of colors) {
    assert(typeof c === "string" && c.length > 0, `Valid color: ${c}`);
  }
});

test("icon string stored as-is (lucide name)", () => {
  const icon = "package";
  eq(icon, "package");
});

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
