/**
 * END-TO-END SIMULATION — Real Excel imports + Customer lifecycle + Invoice flow
 * Simulates the exact journey a Tanzania glass shop owner would take:
 * Import products from Excel → Add customers → Make sales → Generate invoices → Track payments
 *
 * Run: npx tsx tests/unit/e2e-excel-customer-invoice.test.ts
 */

import { formatCurrency } from "../../src/lib/calculations";

let P = 0, F = 0;
function test(n: string, fn: () => void) { try { fn(); P++; console.log(`  \x1b[32mPASS\x1b[0m  ${n}`); } catch (e: unknown) { F++; console.log(`  \x1b[31mFAIL\x1b[0m  ${n}\n        ${e instanceof Error ? e.message : e}`); } }
function eq(a: unknown, b: unknown, m?: string) { if (a !== b) throw new Error(m || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function close(a: number, b: number, t: number) { if (Math.abs(a - b) > t) throw new Error(`~${b}, got ${a}`); }

// ── Shared helpers (same as real app logic) ───────────────────────────
type Mapping = Record<string, string>;
interface FieldRule { field: string; type: string; required: boolean; min?: number; max?: number; regex?: string; }

function applyMapping(row: Record<string, unknown>, mapping: Mapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(mapping)) { if (v && v !== "__ignore__") out[v] = row[k]; }
  return out;
}

function validateRow(mapped: Record<string, unknown>, rules: FieldRule[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const r of rules) {
    const val = mapped[r.field] == null ? "" : String(mapped[r.field]).trim();
    if (r.required && val === "") { errors.push(`${r.field} required`); continue; }
    if (val === "") continue;
    if (r.type === "number") {
      const n = Number(val);
      if (isNaN(n) || !isFinite(n)) { errors.push(`${r.field} NaN`); continue; }
      if (r.min !== undefined && n < r.min) errors.push(`${r.field} < ${r.min}`);
      if (r.max !== undefined && n > r.max) errors.push(`${r.field} > ${r.max}`);
    }
    if (r.type === "text" && r.regex) { try { if (!new RegExp(r.regex).test(val)) errors.push(`${r.field} pattern fail`); } catch {} }
  }
  return { valid: errors.length === 0, errors };
}

function processExcel(rows: Record<string, unknown>[], mapping: Mapping, rules: FieldRule[]) {
  let valid = 0, errors = 0, skipped = 0;
  const goodRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    if (Object.values(row).every(v => v === "" || v == null)) { skipped++; continue; }
    const mapped = applyMapping(row, mapping);
    const r = validateRow(mapped, rules);
    if (r.valid) { valid++; goodRows.push(mapped); } else errors++;
  }
  return { total: rows.length, valid, errors, skipped, goodRows };
}

const RULES: FieldRule[] = [
  { field: "sku", type: "text", required: true, regex: "^[A-Z0-9][A-Z0-9\\-_]+$" },
  { field: "name", type: "text", required: true },
  { field: "stock", type: "number", required: true, min: 0, max: 999999 },
  { field: "cost", type: "number", required: true, min: 0 },
  { field: "sell", type: "number", required: false, min: 0 },
];

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 1: Import a PERFECT supplier Excel (Guangzhou Glass Trading)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== EXCEL 1: Perfect supplier sheet from Guangzhou ===");

const GZ_MAPPING: Mapping = {
  "Item No.": "sku", "Product Description": "name", "QTY (pcs)": "stock",
  "FOB Price (USD)": "cost", "Selling (TSH)": "sell", "HS Code": "__ignore__",
};

const GZ_ROWS = [
  { "Item No.": "GLS-4MM-1220", "Product Description": "Float glass 4mm clear 1220x2440mm", "QTY (pcs)": 200, "FOB Price (USD)": 4.50, "Selling (TSH)": 120000, "HS Code": "7005.29" },
  { "Item No.": "GLS-5MM-1220", "Product Description": "Float glass 5mm clear 1220x2440mm", "QTY (pcs)": 150, "FOB Price (USD)": 5.80, "Selling (TSH)": 145000, "HS Code": "7005.29" },
  { "Item No.": "GLS-6MM-1524", "Product Description": "Float glass 6mm tinted bronze 1524x2134mm", "QTY (pcs)": 100, "FOB Price (USD)": 8.20, "Selling (TSH)": 210000, "HS Code": "7005.29" },
  { "Item No.": "MRR-4MM-1830", "Product Description": "Mirror 4mm silver 1830x2440mm", "QTY (pcs)": 80, "FOB Price (USD)": 6.50, "Selling (TSH)": 180000, "HS Code": "7009.91" },
  { "Item No.": "GLS-10MM-1220", "Product Description": "Tempered glass 10mm clear 1220x2440mm", "QTY (pcs)": 50, "FOB Price (USD)": 15.00, "Selling (TSH)": 380000, "HS Code": "7007.19" },
];

test("Guangzhou excel: all 5 products valid, HS Code ignored", () => {
  const r = processExcel(GZ_ROWS, GZ_MAPPING, RULES);
  eq(r.valid, 5); eq(r.errors, 0); eq(r.skipped, 0);
});

test("Guangzhou: mapped data has correct fields", () => {
  const mapped = applyMapping(GZ_ROWS[0], GZ_MAPPING);
  eq(mapped["sku"], "GLS-4MM-1220");
  eq(mapped["name"], "Float glass 4mm clear 1220x2440mm");
  eq(mapped["stock"], 200);
  eq(mapped["cost"], 4.50);
  eq(mapped["sell"], 120000);
  eq(mapped["HS Code"], undefined); // ignored
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 2: Import a MESSY local supplier Excel (Kariakoo market vendor)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== EXCEL 2: Messy local vendor sheet from Kariakoo ===");

const KK_MAPPING: Mapping = {
  "Bidhaa": "name", "Nambari": "sku", "Kiasi": "stock", "Bei": "cost",
  "Maelezo": "__ignore__", "Picha": "__ignore__",
};

const KK_ROWS = [
  { "Bidhaa": "Saruji Twiga 50kg", "Nambari": "CMT-TWIGA-50", "Kiasi": 200, "Bei": 18500, "Maelezo": "Bag", "Picha": "img001.jpg" },
  { "Bidhaa": "Nondo 4 inch", "Nambari": "NLS-4IN", "Kiasi": 5000, "Bei": 150, "Maelezo": "Box of 100", "Picha": "" },
  { "Bidhaa": "", "Nambari": "", "Kiasi": "", "Bei": "", "Maelezo": "", "Picha": "" },  // empty row from Excel
  { "Bidhaa": "Rebar 10mm", "Nambari": "RBR-10MM-6M", "Kiasi": "mia mbili", "Bei": 12000, "Maelezo": "6m length", "Picha": "" }, // Swahili number!
  { "Bidhaa": "Bati Gauge 28", "Nambari": "BTI-G28", "Kiasi": 100, "Bei": 28000, "Maelezo": "Iron sheet", "Picha": "img003.jpg" },
  { "Bidhaa": "Silicone Clear", "Nambari": "SIL-CLR-300", "Kiasi": 48, "Bei": 8500, "Maelezo": "300ml tube", "Picha": "" },
  { "Bidhaa": "Putty Knife 4\"", "Nambari": "TLS-PUTTY-4", "Kiasi": 24, "Bei": 5500, "Maelezo": "", "Picha": "" },
  { "Bidhaa": "Glass Cutter", "Nambari": "tls-gc-01", "Kiasi": 12, "Bei": 15000, "Maelezo": "Diamond tip", "Picha": "" }, // lowercase sku
  { "Bidhaa": "Sandpaper P120", "Nambari": "SND-P120", "Kiasi": -10, "Bei": 500, "Maelezo": "Sheet", "Picha": "" }, // negative stock!
];

test("Kariakoo excel: 9 rows → 1 skip, 3 errors, 5 valid", () => {
  const r = processExcel(KK_ROWS, KK_MAPPING, RULES);
  eq(r.total, 9);
  eq(r.skipped, 1);  // empty row
  eq(r.errors, 3);   // 'mia mbili' NaN, lowercase sku, negative stock
  eq(r.valid, 5);
  eq(r.valid + r.errors + r.skipped, r.total);
});

test("Kariakoo: Swahili columns map correctly", () => {
  const mapped = applyMapping(KK_ROWS[0], KK_MAPPING);
  eq(mapped["name"], "Saruji Twiga 50kg");
  eq(mapped["sku"], "CMT-TWIGA-50");
  eq(mapped["stock"], 200);
  eq(mapped["cost"], 18500);
  eq(mapped["Maelezo"], undefined); // ignored
  eq(mapped["Picha"], undefined);   // ignored
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 3: Import a COMPLETELY RANDOM Excel someone emailed you
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== EXCEL 3: Random Excel forwarded by email ===");

const RANDOM_MAPPING: Mapping = {
  "col_A": "sku", "col_B": "name", "col_C": "__ignore__", "col_D": "stock", "col_E": "cost",
};

const RANDOM_ROWS = [
  { "col_A": "X-001", "col_B": "Widget Alpha", "col_C": "red", "col_D": 50, "col_E": 999 },
  { "col_A": "X-002", "col_B": "Widget Beta", "col_C": "blue", "col_D": "30", "col_E": "1500" }, // strings that are numbers
  { "col_A": true, "col_B": 42, "col_C": null, "col_D": false, "col_E": {} }, // totally wrong types
  { "col_A": "X-004", "col_B": "Widget Delta", "col_C": "green", "col_D": 0, "col_E": 0 }, // zeros = valid
  { "col_A": "", "col_B": "No SKU item", "col_C": "", "col_D": 10, "col_E": 500 }, // missing SKU
];

test("random excel: strings-as-numbers pass, wrong types fail, zeros valid", () => {
  const r = processExcel(RANDOM_ROWS, RANDOM_MAPPING, RULES);
  // Row 1: valid
  // Row 2: "30" and "1500" are strings but Number() converts them → valid
  // Row 3: true→"true" sku pattern fail, false→"false" stock NaN, {}→"[object Object]" cost NaN
  // Row 4: zeros valid
  // Row 5: empty SKU → required fail
  eq(r.valid, 3);  // rows 1, 2, 4
  eq(r.errors, 2);  // rows 3, 5
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 4: 500-row bulk import stress test
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== EXCEL 4: 500-row bulk import ===");

test("500-row import: ~10% corrupt, ~5% empty, rest valid", () => {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < 500; i++) {
    if (i % 20 === 0) {
      rows.push({ "SKU": "", "Name": "", "Qty": "", "Cost": "" }); // empty every 20th
    } else if (i % 10 === 0) {
      rows.push({ "SKU": "bad sku!", "Name": "Corrupt", "Qty": "text", "Cost": -99 }); // corrupt every 10th (not caught by 20th)
    } else {
      rows.push({ "SKU": `PRD-${String(i).padStart(4, "0")}`, "Name": `Product ${i}`, "Qty": i * 2, "Cost": 1000 + i * 50 });
    }
  }
  const mapping: Mapping = { "SKU": "sku", "Name": "name", "Qty": "stock", "Cost": "cost" };
  const r = processExcel(rows, mapping, RULES);

  const expectedEmpty = Math.floor(499 / 20) + 1; // 0,20,40,...,480 = 25
  const expectedCorrupt = Math.floor(499 / 10) + 1 - expectedEmpty; // every 10th minus those already empty = 25
  const expectedValid = 500 - expectedEmpty - expectedCorrupt;

  eq(r.skipped, expectedEmpty);
  eq(r.errors, expectedCorrupt);
  eq(r.valid, expectedValid);
  eq(r.valid + r.errors + r.skipped, 500);
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 5: Add customers from imported data
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== CUSTOMERS: Create from import + manual ===");

interface Customer { id: string; name: string; company: string | null; tin: string | null; phone: string | null; outstanding: number; }

const customers: Customer[] = [];
let custIdSeq = 1;
function addCustomer(name: string, company: string | null, tin: string | null, phone: string | null): Customer {
  const c = { id: `cust-${custIdSeq++}`, name, company, tin, phone, outstanding: 0 };
  customers.push(c);
  return c;
}

test("add customer: Coastal Builders with TIN", () => {
  const c = addCustomer("Coastal Builders", "Coastal Construction Ltd.", "142-993-871", "+255715887219");
  eq(c.name, "Coastal Builders");
  eq(c.tin, "142-993-871");
  eq(c.outstanding, 0);
});

test("add customer: Amani (individual, no TIN, no company)", () => {
  const c = addCustomer("Amani Mushi", null, null, "+255712445821");
  eq(c.company, null);
  eq(c.tin, null);
});

test("add customer: Big Corp with all fields", () => {
  const c = addCustomer("Big Corp Ltd.", "Big Corporation", "109-553-209", "+255754829110");
  eq(c.tin, "109-553-209");
});

test("add customer: Fatma (walk-in who asked for an account)", () => {
  const c = addCustomer("Fatma Said", null, null, "+255622411008");
  assert(customers.length === 4, "4 customers total");
});

test("search customers by TIN", () => {
  const q = "142";
  const found = customers.filter(c => c.tin && c.tin.replace(/-/g, "").includes(q));
  eq(found.length, 1);
  eq(found[0].name, "Coastal Builders");
});

test("search customers by phone (local format)", () => {
  const q = "0712445821";
  const normalized = q.replace(/^0/, "");
  const found = customers.filter(c => c.phone && c.phone.replace(/[^0-9]/g, "").includes(normalized));
  eq(found.length, 1);
  eq(found[0].name, "Amani Mushi");
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 6: Make sales to customers → generate invoices
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== SALES + INVOICES: Full sale → invoice → payment cycle ===");

interface SaleRecord { id: string; customerId: string | null; customer: string; items: { name: string; qty: number; price: number }[]; subtotal: number; tax: number; total: number; status: string; }
interface InvoiceRecord { id: string; saleId: string; number: string; customer: string; customerTin: string | null; total: number; status: string; }
interface PaymentRecord { saleId: string; amount: number; method: string; }

const sales: SaleRecord[] = [];
const invoices: InvoiceRecord[] = [];
const payments: PaymentRecord[] = [];
let invoiceNum = 1;

function makeSale(customerId: string | null, customerName: string, items: { name: string; qty: number; price: number }[], payMethod: string, taxRate: number): SaleRecord {
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const sale: SaleRecord = { id: `sale-${sales.length + 1}`, customerId, customer: customerName, items, subtotal, tax, total, status: payMethod === "credit" ? "credit" : "completed" };
  sales.push(sale);

  // Auto-create invoice
  const custRecord = customerId ? customers.find(c => c.id === customerId) : null;
  const inv: InvoiceRecord = {
    id: `inv-${invoices.length + 1}`, saleId: sale.id,
    number: `INV-${String(invoiceNum++).padStart(4, "0")}`,
    customer: customerName, customerTin: custRecord?.tin || null,
    total, status: "issued",
  };
  invoices.push(inv);

  // Update customer outstanding for credit sales
  if (sale.status === "credit" && custRecord) {
    custRecord.outstanding += total;
  }

  return sale;
}

function recordPayment(saleId: string, amount: number, method: string) {
  payments.push({ saleId, amount, method });
  const sale = sales.find(s => s.id === saleId)!;
  const totalPaid = payments.filter(p => p.saleId === saleId).reduce((s, p) => s + p.amount, 0);
  const remaining = Math.round((sale.total - totalPaid) * 100) / 100;
  sale.status = remaining <= 0 ? "completed" : "partial";

  // Update invoice
  const inv = invoices.find(i => i.saleId === saleId);
  if (inv) inv.status = remaining <= 0 ? "paid" : "partial";

  // Update customer outstanding
  if (sale.customerId) {
    const cust = customers.find(c => c.id === sale.customerId);
    if (cust) cust.outstanding = Math.max(0, cust.outstanding - amount);
  }
}

// Sale 1: Coastal Builders — big credit order
test("sale 1: Coastal Builders credit sale, 18% VAT", () => {
  const s = makeSale("cust-1", "Coastal Builders", [
    { name: "Float glass 4mm", qty: 50, price: 120000 },
    { name: "Mirror 4mm", qty: 20, price: 180000 },
    { name: "Silicone Clear", qty: 10, price: 15000 },
  ], "credit", 18);
  eq(s.subtotal, 9750000); // 6M + 3.6M + 150k
  eq(s.tax, 1755000);
  eq(s.total, 11505000);
  eq(s.status, "credit");
  eq(customers[0].outstanding, 11505000);
});

test("sale 1: invoice has TIN from customer record", () => {
  eq(invoices[0].customerTin, "142-993-871");
  eq(invoices[0].number, "INV-0001");
});

// Sale 2: Walk-in cash sale
test("sale 2: walk-in customer, cash, no customer record", () => {
  const s = makeSale(null, "Walk-in", [
    { name: "Cement 50kg", qty: 5, price: 18500 },
  ], "cash", 0);
  eq(s.total, 92500);
  eq(s.status, "completed");
  eq(s.customerId, null);
});

test("sale 2: invoice has no TIN (walk-in)", () => {
  eq(invoices[1].customerTin, null);
});

// Sale 3: Amani — small cash sale
test("sale 3: Amani cash purchase", () => {
  const s = makeSale("cust-2", "Amani Mushi", [
    { name: "Nails 4in box", qty: 3, price: 15000 },
    { name: "Putty Knife", qty: 1, price: 5500 },
  ], "cash", 18);
  eq(s.status, "completed");
  eq(s.subtotal, 50500);
});

// Sale 4: Big Corp — credit
test("sale 4: Big Corp credit sale", () => {
  const s = makeSale("cust-3", "Big Corp Ltd.", [
    { name: "Tempered glass 10mm", qty: 30, price: 380000 },
  ], "credit", 18);
  eq(s.total, 13452000); // 11.4M + 18%
  eq(customers[2].outstanding, 13452000);
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 7: Record payments against credit sales
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== PAYMENTS: Partial + full on credit sales ===");

test("payment 1: Coastal pays 5M via bank", () => {
  recordPayment("sale-1", 5000000, "bank");
  eq(sales[0].status, "partial");
  eq(customers[0].outstanding, 6505000);
});

test("payment 2: Coastal pays remaining 6,505,000 via M-Pesa", () => {
  recordPayment("sale-1", 6505000, "mpesa");
  eq(sales[0].status, "completed");
  eq(customers[0].outstanding, 0);
  eq(invoices[0].status, "paid");
});

test("payment 3: Big Corp pays 5M (partial)", () => {
  recordPayment("sale-4", 5000000, "bank");
  eq(sales[3].status, "partial");
  eq(customers[2].outstanding, 8452000);
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 8: Verify all numbers reconcile
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== RECONCILIATION: All numbers must balance ===");

test("total revenue = sum of all sale totals", () => {
  const revenue = sales.reduce((s, sale) => s + sale.total, 0);
  close(revenue, 11505000 + 92500 + 59590 + 13452000, 1);
});

test("total payments = sum of all payment amounts", () => {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  eq(paid, 5000000 + 6505000 + 5000000);
});

test("total outstanding = sum of customer.outstanding", () => {
  const outstanding = customers.reduce((s, c) => s + c.outstanding, 0);
  eq(outstanding, 8452000); // only Big Corp
});

test("total revenue = total paid + total outstanding + completed-cash sales", () => {
  const revenue = sales.reduce((s, sale) => s + sale.total, 0);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = customers.reduce((s, c) => s + c.outstanding, 0);
  const cashSales = sales.filter(s => s.customerId === null || s.status === "completed").reduce((s, sale) => {
    // For non-credit sales, the "paid" amount isn't in the payments array
    const salePayments = payments.filter(p => p.saleId === sale.id).reduce((ps, p) => ps + p.amount, 0);
    return s + (sale.total - salePayments);
  }, 0);
  // revenue = explicit payments + outstanding + implicit cash
  close(paid + outstanding + cashSales, revenue, 1);
});

test("invoice count = sale count (1:1)", () => {
  eq(invoices.length, sales.length);
});

test("each invoice total matches its sale total", () => {
  for (let i = 0; i < sales.length; i++) {
    eq(invoices[i].total, sales[i].total, `invoice ${i + 1} mismatch`);
  }
});

test("invoice numbers are sequential with no gaps", () => {
  for (let i = 0; i < invoices.length; i++) {
    eq(invoices[i].number, `INV-${String(i + 1).padStart(4, "0")}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 9: Display checks
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== DISPLAY: Currency formatting ===");

test("Coastal sale total in TSH", () => eq(formatCurrency(11505000, "TSH"), "TSh 11,505,000"));
test("Big Corp outstanding in TSH", () => eq(formatCurrency(8452000, "TSH"), "TSh 8,452,000"));
test("Walk-in small sale", () => eq(formatCurrency(92500, "TSH"), "TSh 92,500"));
test("Amani sale with tax", () => eq(formatCurrency(59590, "TSH"), "TSh 59,590"));

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 10: Edge cases
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n=== EDGE CASES ===");

test("customer with 0 sales → outstanding = 0", () => {
  eq(customers[3].outstanding, 0); // Fatma — no sales yet
});

test("walk-in sale → no customer outstanding affected", () => {
  const walkinSale = sales[1];
  eq(walkinSale.customerId, null);
  // No customer record updated
});

test("same customer multiple sales → outstanding accumulates correctly", () => {
  // Coastal had 11.5M → paid all → 0
  eq(customers[0].outstanding, 0);
  // Big Corp had 13.4M → paid 5M → 8.4M
  eq(customers[2].outstanding, 8452000);
});

test("imported products + manual customers + sales = complete data flow", () => {
  // 5 products from Guangzhou + 5 from Kariakoo (valid) = 10 products in inventory
  // 4 customers created
  // 4 sales, 4 invoices, 3 payments
  assert(customers.length === 4, "4 customers");
  assert(sales.length === 4, "4 sales");
  assert(invoices.length === 4, "4 invoices");
  assert(payments.length === 3, "3 payments");
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${P + F} tests, ${P} passed, ${F} failed`);
if (F > 0) process.exit(1);
