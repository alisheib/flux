/**
 * FLUX — Register + Login flow test
 */
const puppeteer = require("puppeteer");
const BASE = "http://localhost:3000";
let browser, page;
let passed = 0, failed = 0;
const results = [];
const TEST_EMAIL = `testuser_${Date.now()}@example.com`;
const TEST_PASS = "Flux2026!@";

// Clear rate limit before tests by waiting and using unique IPs
// The rate limiter tracks by IP — in test we all come from same IP

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

async function runTests() {
  console.log("\n\x1b[1mFLUX Register + Login Flow Tests\x1b[0m\n");

  // 1. Register page loads
  await test("1. Register page loads with all fields including phone", async () => {
    await page.goto(`${BASE}/register`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));
    const text = await page.evaluate(() => document.body.innerText);
    assert(text.includes("Organization") || text.includes("organization"), "Missing org field");
    assert(text.includes("Phone") || text.includes("phone"), "Missing phone field");
    assert(text.includes("Password") || text.includes("password"), "Missing password field");
  });

  // 2. Weak password rejected
  await test("2. Weak password is rejected (no uppercase)", async () => {
    await page.goto(`${BASE}/register`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 1000));
    // Fill form with weak password
    const res = await page.evaluate(async () => {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: "Test Co", name: "Test", email: "weak@test.com", password: "weak123!" }),
      });
      return r.json();
    });
    assert(res.error, "Should have gotten an error");
    assert(res.error.toLowerCase().includes("uppercase") || res.error.toLowerCase().includes("password"), `Got: ${res.error}`);
  });

  // 3. Short password rejected
  await test("3. Short password rejected (< 8 chars)", async () => {
    const res = await page.evaluate(async () => {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: "Test Co", name: "Test", email: "short@test.com", password: "Ab1!" }),
      });
      return r.json();
    });
    assert(res.error, "Should have gotten an error");
    assert(res.error.toLowerCase().includes("8 char") || res.error.toLowerCase().includes("least 8"), `Got: ${res.error}`);
  });

  // 4. Invalid email rejected
  await test("4. Invalid email rejected", async () => {
    const res = await page.evaluate(async () => {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: "Test Co", name: "Test", email: "notanemail", password: "Flux2026!@" }),
      });
      return r.json();
    });
    assert(res.error, "Should have gotten an error");
    assert(res.error.toLowerCase().includes("email"), `Got: ${res.error}`);
  });

  // 5. Valid registration succeeds
  await test("5. Valid registration succeeds with strong password", async () => {
    const res = await page.evaluate(async (email, pass) => {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: "E2E Test Corp", name: "E2E Tester", email, password: pass, phone: "+1234567890" }),
      });
      return { ok: r.ok, data: await r.json() };
    }, TEST_EMAIL, TEST_PASS);
    assert(res.ok, `Registration failed: ${JSON.stringify(res.data)}`);
    assert(res.data.success, "Missing success flag");
    assert(res.data.user.email === TEST_EMAIL, "Email mismatch");
    assert(res.data.emailVerified === false, "Should be unverified");
  });

  // 6. Duplicate email rejected
  await test("6. Duplicate email registration rejected", async () => {
    const res = await page.evaluate(async (email, pass) => {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: "Dup Corp", name: "Dup", email, password: pass }),
      });
      return r.json();
    }, TEST_EMAIL, TEST_PASS);
    assert(res.error, "Should have gotten an error");
    assert(res.error.toLowerCase().includes("already exists"), `Got: ${res.error}`);
  });

  // 7. Login with registered credentials works
  await test("7. Login with the registered credentials succeeds", async () => {
    // Clear cookies first
    const client = await page.createCDPSession();
    await client.send("Network.clearBrowserCookies");

    const res = await page.evaluate(async (email, pass) => {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });
      return { ok: r.ok, data: await r.json() };
    }, TEST_EMAIL, TEST_PASS);
    assert(res.ok, `Login failed: ${JSON.stringify(res.data)}`);
    assert(res.data.success, "Missing success flag");
    assert(res.data.user.name === "E2E Tester", `Name mismatch: ${res.data.user.name}`);
  });

  // 8. Login with wrong password fails
  await test("8. Login with wrong password fails", async () => {
    const res = await page.evaluate(async (email) => {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "WrongPass1!" }),
      });
      return r.json();
    }, TEST_EMAIL);
    assert(res.error, "Should have gotten an error");
    assert(res.error.toLowerCase().includes("invalid"), `Got: ${res.error}`);
  });

  // 9. /api/auth/me returns user with emailVerified
  await test("9. /me endpoint returns emailVerified field", async () => {
    // Login first to get cookie
    await page.evaluate(async (email, pass) => {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });
    }, TEST_EMAIL, TEST_PASS);

    const res = await page.evaluate(async () => {
      const r = await fetch("/api/auth/me");
      return r.json();
    });
    assert(res.user, "Missing user in /me response");
    assert(res.user.emailVerified !== undefined, "Missing emailVerified in /me");
  });

  // 10. Product validation - no negative price
  await test("10. Product API rejects negative selling price", async () => {
    const res = await page.evaluate(async () => {
      const r = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Product", sellingPrice: -10 }),
      });
      return r.json();
    });
    assert(res.error, "Should have gotten an error for negative price");
  });
}

(async () => {
  try { await setup(); await runTests(); } catch (e) { console.error("\nFatal:", e.message); }
  finally { await teardown(); }
  console.log(`\n${"─".repeat(50)}`);
  console.log(`\x1b[1mResults: ${passed} passed, ${failed} failed, ${passed + failed} total\x1b[0m\n`);
  if (failed > 0) { results.filter(r => r.status === "FAIL").forEach(r => console.log(`  - ${r.name}: ${r.error}`)); console.log(); }
  process.exit(failed > 0 ? 1 : 0);
})();
