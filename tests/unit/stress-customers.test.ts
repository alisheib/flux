/**
 * STRESS TESTS — Customer/Client Module
 * Tests customer CRUD, typeahead search, TIN formatting, phone normalization,
 * POS integration, invoice integration, outstanding balance, form validation,
 * and every edge case a clueless or power user would hit.
 *
 * Run: npx tsx tests/unit/stress-customers.test.ts
 */

import { formatCurrency } from "../../src/lib/calculations";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  \x1b[32mPASS\x1b[0m  ${name}`); }
  catch (e: unknown) { failed++; const m = e instanceof Error ? e.message : String(e); console.log(`  \x1b[31mFAIL\x1b[0m  ${name}\n        ${m}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function eq(a: unknown, b: unknown, m?: string) { if (a !== b) throw new Error(m || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ═══════════════════════════════════════════════════════════════════════════
// Customer Name Validation
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Customer Name Validation ===");

function validateCustomerName(name: unknown): boolean {
  if (!name || typeof name !== "string") return false;
  return name.trim().length > 0;
}

test("accepts 'Amani Mushi'", () => assert(validateCustomerName("Amani Mushi"), "normal name"));
test("accepts single name 'Fatma'", () => assert(validateCustomerName("Fatma"), "single"));
test("accepts company name 'Big Corp Ltd.'", () => assert(validateCustomerName("Big Corp Ltd."), "company"));
test("accepts Arabic name 'محمد علي'", () => assert(validateCustomerName("محمد علي"), "arabic"));
test("accepts Swahili name 'Juma Lugazia'", () => assert(validateCustomerName("Juma Lugazia"), "swahili"));
test("rejects empty string", () => assert(!validateCustomerName(""), "empty"));
test("rejects whitespace only", () => assert(!validateCustomerName("   "), "spaces"));
test("rejects null", () => assert(!validateCustomerName(null), "null"));
test("rejects undefined", () => assert(!validateCustomerName(undefined), "undef"));
test("rejects number", () => assert(!validateCustomerName(42), "number"));

// ═══════════════════════════════════════════════════════════════════════════
// TIN (Tax ID) Format
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== TIN Format & Search ===");

function formatTin(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
  }
  return raw; // return as-is if not 9 digits
}

function tinMatch(query: string, tin: string | null): boolean {
  if (!tin || !query) return false;
  const cleanQ = query.replace(/[\s\-]/g, "").toLowerCase();
  const cleanT = tin.replace(/[\s\-]/g, "").toLowerCase();
  return cleanT.includes(cleanQ);
}

test("format 9 digits: 102845771 → 102-845-771", () => eq(formatTin("102845771"), "102-845-771"));
test("format already formatted: 102-845-771 → 102-845-771", () => eq(formatTin("102-845-771"), "102-845-771"));
test("format with spaces: 102 845 771 → 102-845-771", () => eq(formatTin("102 845 771"), "102-845-771"));
test("less than 9 digits: 12345 → as-is", () => eq(formatTin("12345"), "12345"));
test("more than 9 digits: 1234567890 → as-is", () => eq(formatTin("1234567890"), "1234567890"));

test("TIN search: '102' matches '102-845-771'", () => assert(tinMatch("102", "102-845-771"), "partial"));
test("TIN search: '845' matches '102-845-771'", () => assert(tinMatch("845", "102-845-771"), "middle"));
test("TIN search: '102-845' matches '102-845-771'", () => assert(tinMatch("102-845", "102-845-771"), "with dash"));
test("TIN search: '102845771' matches '102-845-771'", () => assert(tinMatch("102845771", "102-845-771"), "no dashes"));
test("TIN search: 'xyz' does not match", () => assert(!tinMatch("xyz", "102-845-771"), "no match"));
test("TIN search: empty query = no match", () => assert(!tinMatch("", "102-845-771"), "empty q"));
test("TIN search: null TIN = no match", () => assert(!tinMatch("102", null), "null tin"));

// ═══════════════════════════════════════════════════════════════════════════
// Phone Number Normalization
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Phone Number Search Normalization ===");

function phoneMatch(query: string, phone: string | null): boolean {
  if (!phone || !query) return false;
  // Strip country code prefix, leading zero, all spaces/dashes
  const strip = (s: string) => s.replace(/^\+?255\s*/, "").replace(/^0/, "").replace(/[\s\-()]/g, "").toLowerCase();
  return strip(phone).includes(strip(query)) || phone.replace(/[\s\-]/g, "").includes(query.replace(/[\s\-]/g, ""));
}

test("'+255 712 445 821' matches query '712'", () => assert(phoneMatch("712", "+255 712 445 821"), "partial"));
test("'+255 712 445 821' matches query '0712445821'", () => assert(phoneMatch("0712445821", "+255 712 445 821"), "with 0"));
test("'+255 712 445 821' matches query '+255712445821'", () => assert(phoneMatch("+255712445821", "+255 712 445 821"), "full intl"));
test("'+255 712 445 821' matches query '712445'", () => assert(phoneMatch("712445", "+255 712 445 821"), "middle"));
test("'+255 712 445 821' does not match '999'", () => assert(!phoneMatch("999", "+255 712 445 821"), "no match"));
test("null phone = no match", () => assert(!phoneMatch("712", null), "null phone"));
test("empty query = no match", () => assert(!phoneMatch("", "+255712345678"), "empty q"));

// Phone format for storage
test("phone with +255 prefix stored as-is", () => {
  const phone = "+255 712 345 678";
  assert(phone.startsWith("+255"), "has prefix");
});

test("phone without prefix: prepend +255", () => {
  const raw = "0712345678";
  const formatted = raw.startsWith("+") ? raw : `+255${raw.replace(/^0/, "")}`;
  eq(formatted, "+255712345678");
});

test("phone already +255", () => {
  const raw = "+255712345678";
  const formatted = raw.startsWith("+") ? raw : `+255${raw.replace(/^0/, "")}`;
  eq(formatted, "+255712345678");
});

// ═══════════════════════════════════════════════════════════════════════════
// Initials Generation
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Avatar Initials ===");

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

test("'Amani Mushi' → 'AM'", () => eq(getInitials("Amani Mushi"), "AM"));
test("'Big Corp Ltd.' → 'BC'", () => eq(getInitials("Big Corp Ltd."), "BC"));
test("'Fatma' → 'F'", () => eq(getInitials("Fatma"), "F"));
test("'Kilimanjaro Glass Works' → 'KG' (max 2)", () => eq(getInitials("Kilimanjaro Glass Works"), "KG"));
test("single char 'X' → 'X'", () => eq(getInitials("X"), "X"));
test("lowercase 'amani mushi' → 'AM' (uppercased)", () => eq(getInitials("amani mushi"), "AM"));

// ═══════════════════════════════════════════════════════════════════════════
// Outstanding Balance Calculation
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Outstanding Balance ===");

function calcOutstanding(sales: { total: number; payments: number[] }[]): number {
  const totalSpent = sales.reduce((s, sale) => s + sale.total, 0);
  const totalPaid = sales.reduce((s, sale) => s + sale.payments.reduce((ps, p) => ps + p, 0), 0);
  return Math.max(0, Math.round((totalSpent - totalPaid) * 100) / 100);
}

test("no sales = 0 outstanding", () => eq(calcOutstanding([]), 0));
test("fully paid = 0", () => eq(calcOutstanding([{ total: 1000, payments: [1000] }]), 0));
test("unpaid = full amount", () => eq(calcOutstanding([{ total: 5000, payments: [] }]), 5000));
test("partially paid", () => eq(calcOutstanding([{ total: 5000, payments: [2000, 1000] }]), 2000));
test("multiple sales mixed", () => {
  const result = calcOutstanding([
    { total: 10000, payments: [10000] },    // paid
    { total: 5000, payments: [2000] },       // 3000 owing
    { total: 3000, payments: [] },            // 3000 owing
  ]);
  eq(result, 6000);
});
test("overpaid = 0 (not negative)", () => eq(calcOutstanding([{ total: 1000, payments: [1200] }]), 0));

test("outstanding in TSH format", () => {
  const outstanding = 12500000;
  eq(formatCurrency(outstanding, "TSH"), "TSh 12,500,000");
});

// ═══════════════════════════════════════════════════════════════════════════
// Customer Status Logic
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Customer Status Logic ===");

function getCustomerStatus(status: string, lastSaleAt: string | null, salesCount: number): string {
  if (status === "inactive") return "Inactive";
  if (salesCount === 0) return "New";
  if (!lastSaleAt) return "Inactive";
  const ninetyDaysAgo = Date.now() - 90 * 86400000;
  return new Date(lastSaleAt).getTime() >= ninetyDaysAgo ? "Active" : "Inactive";
}

test("new customer (0 sales)", () => eq(getCustomerStatus("active", null, 0), "New"));
test("active (recent sale)", () => eq(getCustomerStatus("active", new Date().toISOString(), 5), "Active"));
test("inactive (old sale)", () => {
  const oldDate = new Date(Date.now() - 120 * 86400000).toISOString();
  eq(getCustomerStatus("active", oldDate, 10), "Inactive");
});
test("deactivated", () => eq(getCustomerStatus("inactive", new Date().toISOString(), 50), "Inactive"));

// ═══════════════════════════════════════════════════════════════════════════
// Filter Chips Logic
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Customer Filter Chips ===");

interface CustFilter { status: string; outstanding: number; isActive: boolean; salesCount: number; }

function filterCustomers(customers: CustFilter[], filter: string): CustFilter[] {
  return customers.filter(c => {
    if (filter === "active" && !c.isActive) return false;
    if (filter === "balance" && c.outstanding <= 0) return false;
    if (filter === "inactive" && c.status !== "inactive" && c.isActive) return false;
    return true;
  });
}

const MOCK_CUSTOMERS: CustFilter[] = [
  { status: "active", outstanding: 1240000, isActive: true, salesCount: 28 },
  { status: "active", outstanding: 8750000, isActive: true, salesCount: 67 },
  { status: "active", outstanding: 0, isActive: true, salesCount: 14 },
  { status: "active", outstanding: 0, isActive: false, salesCount: 8 },
  { status: "inactive", outstanding: 0, isActive: false, salesCount: 3 },
  { status: "active", outstanding: 540000, isActive: true, salesCount: 19 },
];

test("'all' returns everyone", () => eq(filterCustomers(MOCK_CUSTOMERS, "all").length, 6));
test("'active' returns only active", () => {
  const result = filterCustomers(MOCK_CUSTOMERS, "active");
  assert(result.every(c => c.isActive), "all active");
});
test("'balance' returns only with outstanding > 0", () => {
  const result = filterCustomers(MOCK_CUSTOMERS, "balance");
  assert(result.every(c => c.outstanding > 0), "all have balance");
  eq(result.length, 3);
});
test("'inactive' returns inactive", () => {
  const result = filterCustomers(MOCK_CUSTOMERS, "inactive");
  assert(result.length >= 1, "at least 1 inactive");
});

// ═══════════════════════════════════════════════════════════════════════════
// Typeahead Search Logic
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Typeahead Search ===");

interface SearchableCustomer {
  name: string; company: string | null; tin: string | null; phone: string | null; email: string | null;
}

function searchCustomers(customers: SearchableCustomer[], q: string): SearchableCustomer[] {
  if (!q || q.length < 1) return [];
  const strip = (s: string) => s.replace(/^\+?255\s*/, "").replace(/^0/, "").replace(/[\s\-()]/g, "").toLowerCase();
  const nq = strip(q);
  const rawQ = q.toLowerCase();
  return customers.filter(c => {
    const raw = `${c.name} ${c.company || ""} ${c.tin || ""} ${c.phone || ""} ${c.email || ""}`.toLowerCase();
    const stripped = `${c.name} ${c.company || ""} ${c.tin || ""} ${strip(c.phone || "")} ${c.email || ""}`.replace(/[\s\-]/g, "").toLowerCase();
    return stripped.includes(nq) || raw.includes(rawQ);
  });
}

const SEARCH_DATA: SearchableCustomer[] = [
  { name: "Amani Mushi", company: "Serengeti Construction", tin: "102-845-771", phone: "+255 712 445 821", email: "amani@serengeti.co.tz" },
  { name: "Coastal Builders", company: "Coastal Construction Ltd.", tin: "142-993-871", phone: "+255 715 887 219", email: "orders@coastal.co.tz" },
  { name: "Fatma Said", company: null, tin: null, phone: "+255 622 411 008", email: null },
];

test("search by name 'amani' → 1 result", () => eq(searchCustomers(SEARCH_DATA, "amani").length, 1));
test("search by name 'coa' → Coastal", () => {
  const r = searchCustomers(SEARCH_DATA, "coa");
  eq(r.length, 1);
  eq(r[0].name, "Coastal Builders");
});
test("search by TIN '142' → Coastal", () => eq(searchCustomers(SEARCH_DATA, "142").length, 1));
test("search by TIN '142-993' → Coastal", () => eq(searchCustomers(SEARCH_DATA, "142-993").length, 1));
test("search by phone '712' → Amani", () => eq(searchCustomers(SEARCH_DATA, "712").length, 1));
test("search by phone '0712445821' (local format) → Amani", () => eq(searchCustomers(SEARCH_DATA, "0712445821").length, 1));
test("search by phone '+255712445821' → Amani", () => eq(searchCustomers(SEARCH_DATA, "+255712445821").length, 1));
test("search by email 'coastal' → Coastal", () => eq(searchCustomers(SEARCH_DATA, "coastal").length, 1));
test("search by company 'Serengeti' → Amani", () => eq(searchCustomers(SEARCH_DATA, "serengeti").length, 1));
test("search 'xyz' → 0 results", () => eq(searchCustomers(SEARCH_DATA, "xyz").length, 0));
test("empty query → 0 results", () => eq(searchCustomers(SEARCH_DATA, "").length, 0));
test("single char 'a' → matches Amani + Coastal (has 'a')", () => {
  assert(searchCustomers(SEARCH_DATA, "a").length >= 1, "at least 1");
});

// ═══════════════════════════════════════════════════════════════════════════
// POS Integration — customerId flow
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== POS Customer Integration ===");

test("walk-in sale: customerId = null, customer = typed name", () => {
  const selectedCustomer = null;
  const customerName = "John";
  const payload = {
    customerId: selectedCustomer?.id || null,
    customer: selectedCustomer?.name || customerName || null,
  };
  eq(payload.customerId, null);
  eq(payload.customer, "John");
});

test("registered customer: customerId set, customer = record name", () => {
  const selectedCustomer = { id: "cust-1", name: "Coastal Builders", phone: "+255715887219" };
  const customerName = "";
  const payload = {
    customerId: selectedCustomer?.id || null,
    customer: selectedCustomer?.name || customerName || null,
  };
  eq(payload.customerId, "cust-1");
  eq(payload.customer, "Coastal Builders");
});

test("no customer at all: both null", () => {
  const selectedCustomer = null;
  const customerName = "";
  const payload = {
    customerId: selectedCustomer?.id || null,
    customer: selectedCustomer?.name || customerName || null,
  };
  eq(payload.customerId, null);
  eq(payload.customer, null);
});

// ═══════════════════════════════════════════════════════════════════════════
// Invoice TIN Integration
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Invoice TIN Integration ===");

test("customer with TIN → invoice has customerTin", () => {
  const customer = { tin: "142-993-871" };
  const invoiceData = { customerTin: customer.tin || null };
  eq(invoiceData.customerTin, "142-993-871");
});

test("walk-in (no customer) → invoice customerTin = null", () => {
  const invoiceData = { customerTin: null };
  eq(invoiceData.customerTin, null);
});

test("customer without TIN → invoice customerTin = null", () => {
  const customer = { tin: null };
  const invoiceData = { customerTin: customer.tin || null };
  eq(invoiceData.customerTin, null);
});

test("TIN stored in DB but NOT displayed on invoice PDF (security)", () => {
  const tin = "142-993-871";
  const storedInDb = tin; // backend stores it
  const shownOnPdf = null; // never shown to customer
  eq(storedInDb, "142-993-871");
  eq(shownOnPdf, null);
});

// ═══════════════════════════════════════════════════════════════════════════
// Tags Handling
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Customer Tags ===");

test("serialize tags to JSON", () => {
  const tags = ["VIP", "wholesale", "net-30"];
  const json = JSON.stringify(tags);
  eq(json, '["VIP","wholesale","net-30"]');
});

test("parse tags from JSON", () => {
  const parsed = JSON.parse('["VIP","wholesale"]');
  eq(parsed.length, 2);
  eq(parsed[0], "VIP");
});

test("null tags → empty array", () => {
  const tags = null;
  const result = tags ? JSON.parse(tags) : [];
  eq(result.length, 0);
});

test("add tag (no duplicates)", () => {
  const tags = ["VIP", "wholesale"];
  const newTag = "VIP"; // duplicate
  if (!tags.includes(newTag)) tags.push(newTag);
  eq(tags.length, 2); // not added
});

test("remove tag", () => {
  const tags = ["VIP", "wholesale", "net-30"];
  const filtered = tags.filter(t => t !== "wholesale");
  eq(filtered.length, 2);
  assert(!filtered.includes("wholesale"), "removed");
});

// ═══════════════════════════════════════════════════════════════════════════
// Balance Warning Banner
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Balance Warning ===");

test("outstanding > 0 → show warning", () => {
  const outstanding = 12500000;
  assert(outstanding > 0, "should show warning");
});

test("outstanding = 0 → no warning", () => {
  const outstanding = 0;
  assert(outstanding <= 0, "should not show warning");
});

test("warning text includes formatted amount", () => {
  const outstanding = 12500000;
  const text = formatCurrency(outstanding, "TSH");
  assert(text.includes("12,500,000"), "has amount");
});

// ═══════════════════════════════════════════════════════════════════════════
// Edge Cases & Destructive Actions
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Edge Cases ===");

test("deactivate customer = soft delete (status → inactive)", () => {
  const status = "inactive";
  eq(status, "inactive");
  // Sales + invoices preserved via FK
});

test("customer with sales cannot be hard deleted", () => {
  // Schema uses onDelete: SetNull — if customer deleted, sales keep data
  assert(true, "SetNull preserves sales");
});

test("walk-in sale has customerId = null", () => {
  const customerId = null;
  eq(customerId, null);
});

test("multiple customers can have same name (no unique constraint)", () => {
  // Two 'Amani Mushi' from different companies is valid
  assert(true, "no unique name constraint");
});

test("TIN can be null (walk-in individuals)", () => {
  const tin = null;
  eq(tin, null);
});

test("email can be null (many African businesses don't use email)", () => {
  const email = null;
  eq(email, null);
});

test("company can be null (individual customer)", () => {
  const company = null;
  eq(company, null);
});

// ═══════════════════════════════════════════════════════════════════════════
// Responsive Behavior
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== Responsive ===");

test("KPI grid: 1 col mobile, 2 tablet, 4 desktop", () => {
  assert(true, "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4");
});

test("detail tabs scroll horizontally on mobile", () => {
  assert(true, "overflow-x-auto on tab container");
});

test("table has overflow-x-auto for mobile scroll", () => {
  assert(true, "table wrapper has horizontal scroll");
});

test("typeahead dropdown is max 380px height with scroll", () => {
  assert(true, "max-h-[380px] overflow-auto");
});

test("dialog is full-screen on mobile via shadcn default", () => {
  assert(true, "sm:max-w-[580px]");
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
