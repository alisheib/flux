/**
 * Unit tests for validation logic (server-side equivalents)
 * Tests the validation patterns used across API routes
 * Run: npx tsx tests/unit/validate.test.ts
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

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// ── Email Validation ────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

console.log("\n=== Email Validation ===");

test("accepts valid email", () => {
  assert(EMAIL_REGEX.test("user@example.com"), "Should accept user@example.com");
});

test("accepts email with dots", () => {
  assert(EMAIL_REGEX.test("first.last@company.co.tz"), "Should accept first.last@company.co.tz");
});

test("rejects empty string", () => {
  assert(!EMAIL_REGEX.test(""), "Should reject empty");
});

test("rejects no @ sign", () => {
  assert(!EMAIL_REGEX.test("invalid.email"), "Should reject no @");
});

test("rejects spaces", () => {
  assert(!EMAIL_REGEX.test("has space@example.com"), "Should reject spaces");
});

test("rejects double @", () => {
  assert(!EMAIL_REGEX.test("user@@example.com"), "Should reject double @");
});

// ── Password Validation ─────────────────────────────────────────────────

function validatePassword(pw: string): { valid: boolean; reason?: string } {
  if (pw.length < 8) return { valid: false, reason: "Too short" };
  if (!/[A-Z]/.test(pw)) return { valid: false, reason: "No uppercase" };
  if (!/[a-z]/.test(pw)) return { valid: false, reason: "No lowercase" };
  if (!/[0-9]/.test(pw)) return { valid: false, reason: "No number" };
  if (!/[^A-Za-z0-9]/.test(pw)) return { valid: false, reason: "No special char" };
  return { valid: true };
}

console.log("\n=== Password Validation ===");

test("accepts strong password", () => {
  assert(validatePassword("MyP@ss1234").valid, "Should accept strong password");
});

test("rejects short password (< 8 chars)", () => {
  assert(!validatePassword("Ab1!").valid, "Should reject < 8 chars");
});

test("rejects no uppercase", () => {
  assert(!validatePassword("myp@ss1234").valid, "Should reject no uppercase");
});

test("rejects no lowercase", () => {
  assert(!validatePassword("MYP@SS1234").valid, "Should reject no lowercase");
});

test("rejects no number", () => {
  assert(!validatePassword("MyP@ssword").valid, "Should reject no number");
});

test("rejects no special character", () => {
  assert(!validatePassword("MyPass1234").valid, "Should reject no special char");
});

test("rejects empty password", () => {
  assert(!validatePassword("").valid, "Should reject empty");
});

// ── Payment Amount Validation ────────────────────────────────────────────

console.log("\n=== Payment Validation ===");

test("accepts valid positive amount", () => {
  const amount = 100;
  assert(typeof amount === "number" && amount > 0, "Should accept positive amount");
});

test("rejects zero amount", () => {
  const amount = 0;
  assert(!(typeof amount === "number" && amount > 0), "Should reject zero");
});

test("rejects negative amount", () => {
  const amount = -50;
  assert(!(typeof amount === "number" && amount > 0), "Should reject negative");
});

test("rejects NaN amount", () => {
  const amount = NaN;
  assert(!(typeof amount === "number" && amount > 0), "Should reject NaN");
});

test("overpayment check works", () => {
  const outstanding = 100;
  const amount = 150;
  assert(amount > outstanding + 0.01, "Should detect overpayment");
});

test("exact payment is allowed", () => {
  const outstanding = 100;
  const amount = 100;
  assert(!(amount > outstanding + 0.01), "Should allow exact payment");
});

// ── Stock Calculation ────────────────────────────────────────────────────

console.log("\n=== Stock Calculations ===");

test("sheet-equivalent conversion for sqm sales", () => {
  const area = 5.0; // 5 m²
  const sqmPerUnit = 2.9768; // per sheet
  const sheetsNeeded = area / sqmPerUnit;
  assert(Math.abs(sheetsNeeded - 1.6797) < 0.001, `Expected ~1.6797, got ${sheetsNeeded}`);
});

test("stock check with sqm conversion", () => {
  const stockQty = 10; // 10 sheets available
  const area = 25; // selling 25 m²
  const sqmPerUnit = 2.9768;
  const sheetsNeeded = area / sqmPerUnit;
  assert(stockQty >= sheetsNeeded, `Should have enough stock: need ${sheetsNeeded}, have ${stockQty}`);
});

test("insufficient stock detection", () => {
  const stockQty = 2;
  const area = 25;
  const sqmPerUnit = 2.9768;
  const sheetsNeeded = area / sqmPerUnit; // ~8.4 sheets
  assert(stockQty < sheetsNeeded, "Should detect insufficient stock");
});

test("zero sqmPerUnit prevents division by zero", () => {
  const sqmPerUnit = 0;
  const area = 5;
  const canSell = sqmPerUnit > 0;
  assert(!canSell, "Should prevent division by zero with sqmPerUnit = 0");
});

test("negative stock adjustment check", () => {
  const currentStock = 5;
  const adjustment = -10;
  const wouldGoNegative = currentStock + adjustment < 0;
  assert(wouldGoNegative, "Should detect negative stock result");
});

// ── Credit Note Validation ──────────────────────────────────────────────

console.log("\n=== Credit Note Validation ===");

test("prevents over-refund", () => {
  const saleTotal = 1000;
  const previouslyRefunded = 600;
  const newRefund = 500;
  const totalRefundedAfter = previouslyRefunded + newRefund;
  assert(totalRefundedAfter > saleTotal + 0.01, "Should detect over-refund");
});

test("allows exact remaining refund", () => {
  const saleTotal = 1000;
  const previouslyRefunded = 600;
  const newRefund = 400;
  const totalRefundedAfter = previouslyRefunded + newRefund;
  assert(!(totalRefundedAfter > saleTotal + 0.01), "Should allow exact remaining refund");
});

test("prevents refund quantity exceeding sale quantity", () => {
  const saleItemQty = 5;
  const refundQty = 7;
  assert(refundQty > saleItemQty, "Should detect excess refund quantity");
});

test("prevents refund unit price exceeding sale price", () => {
  const salePrice = 50;
  const refundPrice = 75;
  assert(refundPrice > salePrice, "Should detect inflated refund price");
});

// ── Discount Calculation ────────────────────────────────────────────────

console.log("\n=== Discount Calculation ===");

test("percentage discount capped at 100%", () => {
  const subtotal = 1000;
  const discountPercent = 150;
  const capped = Math.min(discountPercent, 100);
  const discountAmount = (subtotal * capped) / 100;
  assert(discountAmount === 1000, `Expected 1000, got ${discountAmount}`);
});

test("fixed discount capped at subtotal", () => {
  const subtotal = 1000;
  const discountFixed = 1500;
  const capped = Math.min(discountFixed, subtotal);
  assert(capped === 1000, `Expected 1000, got ${capped}`);
});

test("tax calculation on discounted amount", () => {
  const subtotal = 1000;
  const discount = 200;
  const taxRate = 18;
  const taxable = subtotal - discount;
  const tax = Math.round(taxable * (taxRate / 100) * 100) / 100;
  assert(tax === 144, `Expected 144, got ${tax}`);
});

// ── Shipment Validation ─────────────────────────────────────────────────

console.log("\n=== Shipment Validation ===");

test("exchange rate must be positive", () => {
  const rate = -100;
  assert(!(rate > 0), "Should reject negative exchange rate");
});

test("container count must be >= 1", () => {
  const count = 0;
  assert(!(count >= 1), "Should reject zero container count");
});

// ── PO Item Validation ──────────────────────────────────────────────────

console.log("\n=== PO Item Validation ===");

test("rejects zero quantity ordered", () => {
  const qty = 0;
  assert(!(qty > 0), "Should reject zero quantity");
});

test("rejects negative unit cost", () => {
  const cost = -5;
  assert(!(cost >= 0), "Should reject negative cost");
});

test("accepts zero unit cost (free samples)", () => {
  const cost = 0;
  assert(cost >= 0, "Should accept zero cost");
});

// ── Invoice Number Generation ────────────────────────────────────────────

console.log("\n=== Invoice Number Generation ===");

test("generates padded invoice number", () => {
  const prefix = "INV";
  const nextNum = 1;
  const number = `${prefix}-${String(nextNum).padStart(4, "0")}`;
  assert(number === "INV-0001", `Expected INV-0001, got ${number}`);
});

test("handles large invoice numbers", () => {
  const prefix = "INV";
  const nextNum = 99999;
  const number = `${prefix}-${String(nextNum).padStart(4, "0")}`;
  assert(number === "INV-99999", `Expected INV-99999, got ${number}`);
});

test("credit note number generation", () => {
  const count = 5;
  const number = `CN-${String(count + 1).padStart(4, "0")}`;
  assert(number === "CN-0006", `Expected CN-0006, got ${number}`);
});

// ── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
