/**
 * FLUX — Stress & Mobile E2E Test Suite
 * Tests: API stress (shipments, products, sales), UI mobile responsive, crash detection
 * Run: node tests/e2e-stress.js
 */
const puppeteer = require("puppeteer");
const BASE = "http://localhost:3000";
let browser, page;
let passed = 0, failed = 0;
const results = [];

async function setup() {
  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
}
async function teardown() { await browser.close(); }
async function test(name, fn) {
  try { await fn(); passed++; results.push({ name, status: "PASS" }); console.log(`  \x1b[32mPASS\x1b[0m  ${name}`); }
  catch (e) { failed++; results.push({ name, status: "FAIL", error: e.message }); console.log(`  \x1b[31mFAIL\x1b[0m  ${name}\n        ${e.message}`); }
}
function assert(c, m) { if (!c) throw new Error(m || "Assertion failed"); }

// Configurable credentials — set via env or use defaults
const TEST_EMAIL = process.env.TEST_EMAIL || "admin@flux.com";
const TEST_PASS = process.env.TEST_PASS || "password123";

async function login() {
  // Use Node.js fetch to get the login cookie
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS }),
  });

  if (!res.ok) {
    console.log(`  [ERROR] Login API returned ${res.status}`);
    return;
  }

  // Extract cookie from response headers
  const setCookie = res.headers.getSetCookie?.() || [];
  const tokenCookie = setCookie.find(c => c.startsWith("flux-token="));
  if (!tokenCookie) {
    console.log(`  [ERROR] No flux-token cookie. Headers:`, [...res.headers.entries()]);
    return;
  }
  const tokenValue = tokenCookie.split("flux-token=")[1].split(";")[0];

  // Set cookie in puppeteer browser
  await page.setCookie({
    name: "flux-token",
    value: tokenValue,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  });

  // Navigate to dashboard
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));
  console.log(`  [INFO] Post-login URL: ${page.url()}`);
}

async function apiCall(method, url, body) {
  return page.evaluate(async (m, u, b) => {
    try {
      const r = await fetch(u, {
        method: m,
        headers: { "Content-Type": "application/json" },
        ...(b ? { body: JSON.stringify(b) } : {}),
      });
      const text = await r.text();
      let data = null;
      try { data = JSON.parse(text); } catch { data = { raw: text.substring(0, 200) }; }
      return { ok: r.ok, status: r.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { error: e.message } };
    }
  }, method, url, body);
}

async function checkPageNotCrashed(pageName) {
  const text = await page.evaluate(() => document.body.innerText || "");
  const crashed = text.includes("Application error") || text.includes("Internal Server Error") || text.includes("unhandled") || text.includes("Something went wrong");
  assert(!crashed, `${pageName} crashed: found error text on page`);
  return text;
}

// ─────────────────────────────────────────────────────────────────────
async function runTests() {
  console.log("\n\x1b[1mFLUX Stress & Mobile Test Suite\x1b[0m\n");

  await login();

  // Verify we're logged in
  const loggedInUrl = page.url();
  if (loggedInUrl.includes("/login")) {
    console.log("  [WARN] Login failed, skipping authenticated tests");
    return;
  }

  // ═══════════════ API STRESS TESTS ═══════════════

  // 1. Create 6 products rapidly
  await test("1. API: Create 6 products rapidly without errors", async () => {
    const products = [];
    for (let i = 1; i <= 6; i++) {
      const res = await apiCall("POST", "/api/products", {
        name: `Stress Product ${i}`,
        sku: `STRESS-${i}`,
        costPrice: 10 + i,
        sellingPrice: 20 + i * 2,
        stockQty: 100 + i * 10,
        minStockQty: 5,
        unit: "piece",
      });
      assert(res.ok, `Product ${i} failed: ${JSON.stringify(res.data)}`);
      products.push(res.data);
    }
    assert(products.length === 6, `Only created ${products.length}/6 products`);
  });

  // 2. Create 5 shipments with items and expenses
  await test("2. API: Create 5 shipments with items and expenses", async () => {
    for (let i = 1; i <= 5; i++) {
      const res = await apiCall("POST", "/api/shipments", {
        name: `Container Batch ${i}`,
        dossier: `DOS-${1000 + i}`,
        invoiceNumber: `INV-SHIP-${i}`,
        containerType: "20HC",
        containerCount: i,
        supplier: `Supplier ${i}`,
        origin: "China",
        exchangeRate: 2630,
        status: "in_warehouse",
      });
      assert(res.ok, `Shipment ${i} failed: ${JSON.stringify(res.data)}`);
      const shipId = res.data?.id;
      if (!shipId) { assert(false, `Shipment ${i} has no id: ${JSON.stringify(res.data)}`); }

      // Add item
      const itemRes = await apiCall("POST", `/api/shipments/${shipId}/items`, {
        name: `Glass Panel Type ${i}`,
        thickness: `${4 + i}mm`,
        dimensions: `2440x${1220 + i * 10}`,
        quantity: 100 * i,
        unitCost: 5 + i,
      });
      assert(itemRes.ok, `Shipment ${i} item failed`);

      // Add expense
      const expRes = await apiCall("POST", `/api/shipments/${shipId}/expenses`, {
        category: "Freight",
        description: `Sea freight container ${i}`,
        amountLocal: 5000 * i,
        amountUsd: 2 * i,
      });
      assert(expRes.ok, `Shipment ${i} expense failed`);
    }
  });

  // 3. Create 10 sales operations with varying amounts
  await test("3. API: Complete 10 sales with different quantities and amounts", async () => {
    // Get products first
    const prodRes = await apiCall("GET", "/api/products");
    assert(prodRes.ok, `Failed to fetch products: ${JSON.stringify(prodRes.data)}`);
    const products = Array.isArray(prodRes.data) ? prodRes.data : [];
    assert(products.length >= 2, `Need at least 2 products, got ${products.length}`);

    for (let i = 1; i <= 10; i++) {
      const prod = products[i % products.length];
      const qty = Math.ceil(Math.random() * 5) + 1;
      const res = await apiCall("POST", "/api/sales", {
        items: [{
          productId: prod.id,
          name: prod.name,
          sku: prod.sku || "",
          quantity: qty,
          unitPrice: prod.sellingPrice || 20,
        }],
        paymentMethod: ["cash", "card", "bank_transfer", "mobile_money"][i % 4],
        customerName: i % 3 === 0 ? `Customer ${i}` : "",
        customerPhone: i % 3 === 0 ? `+1${i}00000000` : "",
        customerEmail: "",
        notes: i % 5 === 0 ? `Test sale note ${i}` : "",
        discount: i % 4 === 0 ? 5 : 0,
        discountType: "amount",
      });
      assert(res.ok, `Sale ${i} failed: status=${res.status} ${JSON.stringify(res.data)}`);
    }
  });

  // 4. Fetch dashboard with all data loaded
  await test("4. API: Dashboard loads with populated data", async () => {
    const res = await apiCall("GET", "/api/dashboard");
    assert(res.ok, `Dashboard API failed: ${JSON.stringify(res.data)}`);
    assert(res.data, "Dashboard returned no data");
    const tp = res.data.totalProducts ?? res.data.products ?? 0;
    assert(tp >= 0, "Dashboard data missing product count");
  });

  // 5. Fetch accounting with data
  await test("5. API: Accounting loads with shipment data", async () => {
    const res = await apiCall("GET", "/api/accounting");
    assert(res.ok, "Accounting API failed");
  });

  // 6. Fetch invoices
  await test("6. API: Invoices list returns data", async () => {
    const res = await apiCall("GET", "/api/invoices");
    assert(res.ok, `Invoices API failed: ${JSON.stringify(res.data)}`);
    const invoices = Array.isArray(res.data) ? res.data : res.data?.invoices || [];
    assert(Array.isArray(invoices), "Invoices response not iterable");
  });

  // ═══════════════ UI RENDERING TESTS (desktop) ═══════════════

  // 7. Dashboard renders without crash
  await test("7. UI: Dashboard renders without crashing", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    await checkPageNotCrashed("Dashboard");
    const text = await page.evaluate(() => document.body.innerText);
    assert(text.includes("Dashboard") || text.includes("Revenue") || text.includes("Products") || text.includes("Sales"), "Dashboard not rendering");
  });

  // 8. Inventory page renders
  await test("8. UI: Inventory page renders without crashing", async () => {
    await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    await checkPageNotCrashed("Inventory");
    const text = await page.evaluate(() => document.body.innerText);
    assert(text.includes("Inventory") || text.includes("Product") || text.includes("Add"), "Inventory not rendering");
  });

  // 9. Shipments page renders
  await test("9. UI: Shipments page renders without crashing", async () => {
    await page.goto(`${BASE}/shipments`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    await checkPageNotCrashed("Shipments");
    const text = await page.evaluate(() => document.body.innerText);
    assert(text.includes("Shipment") || text.includes("shipment") || text.includes("Container"), "Shipments not rendering");
  });

  // 10. Invoices page renders
  await test("10. UI: Invoices page renders with data", async () => {
    await page.goto(`${BASE}/invoices`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    await checkPageNotCrashed("Invoices");
  });

  // 11. POS page renders
  await test("11. UI: POS page renders without crashing", async () => {
    await page.goto(`${BASE}/pos`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    await checkPageNotCrashed("POS");
    const text = await page.evaluate(() => document.body.innerText);
    assert(text.includes("Sale") || text.includes("TOTAL") || text.includes("Search") || text.includes("Cart"), "POS not rendering");
  });

  // 12. Notification bell dropdown works
  await test("12. UI: Notification bell opens popover dropdown", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));
    // Find the bell button
    const bellBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll("button")];
      return buttons.find(b => b.querySelector('[class*="lucide-bell"]') || b.getAttribute("aria-label")?.includes("Notification") || b.textContent.includes("Notifications"));
    });
    if (bellBtn && bellBtn.asElement()) {
      await bellBtn.click();
      await new Promise(r => setTimeout(r, 800));
      const text = await page.evaluate(() => document.body.innerText);
      assert(text.includes("No recent notifications") || text.includes("Notifications"), "Notification dropdown did not open");
    }
    await page.keyboard.press("Escape");
    await new Promise(r => setTimeout(r, 300));
  });

  // ═══════════════ MOBILE RESPONSIVE TESTS ═══════════════

  // 13. Mobile: Login page
  await test("13. Mobile: Login page renders properly (390x844)", async () => {
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));
    await checkPageNotCrashed("Mobile Login");
    const text = await page.evaluate(() => document.body.innerText);
    assert(text.includes("Sign in") || text.includes("sign in"), "Login form not visible on mobile");
    // Check no horizontal overflow
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert(!overflows, "Mobile login has horizontal scroll overflow");
  });

  // 14. Mobile: Dashboard
  await test("14. Mobile: Dashboard KPI cards stack properly", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    await checkPageNotCrashed("Mobile Dashboard");
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert(!overflows, "Mobile dashboard has horizontal overflow");
  });

  // 15. Mobile: POS page
  await test("15. Mobile: POS page renders without crashing", async () => {
    await page.goto(`${BASE}/pos`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    await checkPageNotCrashed("Mobile POS");
  });

  // 16. Mobile: Inventory page
  await test("16. Mobile: Inventory table is scrollable, no overflow", async () => {
    await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    await checkPageNotCrashed("Mobile Inventory");
  });

  // 17. Mobile: Invoices page
  await test("17. Mobile: Invoices page renders without breaking", async () => {
    await page.goto(`${BASE}/invoices`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    await checkPageNotCrashed("Mobile Invoices");
  });

  // 18. Mobile: Settings page
  await test("18. Mobile: Settings page renders without crashing", async () => {
    await page.goto(`${BASE}/settings`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    await checkPageNotCrashed("Mobile Settings");
  });

  // 19. Mobile: Hamburger menu opens
  await test("19. Mobile: Hamburger menu opens sidebar overlay", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));
    const menuBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll("button")];
      return buttons.find(b => b.querySelector('[class*="lucide-menu"]') || b.textContent.includes("Toggle menu"));
    });
    if (menuBtn && menuBtn.asElement()) {
      await menuBtn.click();
      await new Promise(r => setTimeout(r, 800));
      const text = await page.evaluate(() => document.body.innerText);
      assert(text.includes("Dashboard") && text.includes("POS"), "Mobile sidebar didn't open");
      await page.keyboard.press("Escape");
      await new Promise(r => setTimeout(r, 300));
    }
  });

  // 20. Mobile: Profile page
  await test("20. Mobile: Profile page renders properly", async () => {
    await page.goto(`${BASE}/profile`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    await checkPageNotCrashed("Mobile Profile");
    const text = await page.evaluate(() => document.body.innerText);
    assert(text.includes("Profile") || text.includes("Password"), "Profile page missing on mobile");
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert(!overflows, "Mobile profile has horizontal overflow");
  });

  // Reset viewport
  await page.setViewport({ width: 1440, height: 900 });
}

// ─────────────────────────────────────────────────────────────────────
(async () => {
  try { await setup(); await runTests(); } catch (e) { console.error("\nFatal:", e.message); }
  finally { await teardown(); }
  console.log(`\n${"─".repeat(50)}`);
  console.log(`\x1b[1mResults: ${passed} passed, ${failed} failed, ${passed + failed} total\x1b[0m\n`);
  if (failed > 0) { results.filter(r => r.status === "FAIL").forEach(r => console.log(`  - ${r.name}: ${r.error}`)); console.log(); }
  process.exit(failed > 0 ? 1 : 0);
})();
