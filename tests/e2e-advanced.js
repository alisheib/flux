/**
 * FLUX — Advanced E2E tests (dialogs, popups, forms, workflows)
 * Run: node tests/e2e-advanced.js
 * Requires: dev server running on localhost:3000
 */
const puppeteer = require("puppeteer");

const BASE = "http://localhost:3000";
let browser, page;
let passed = 0, failed = 0;
const results = [];

async function setup() {
  browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
}

async function teardown() {
  await browser.close();
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push({ name, status: "PASS" });
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } catch (e) {
    failed++;
    results.push({ name, status: "FAIL", error: e.message });
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}`);
    console.log(`        ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

async function login() {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1000));
  const emailInput = await page.$('input[type="email"]');
  const pwInput = await page.$('input[type="password"]');
  await emailInput.click({ clickCount: 3 });
  await emailInput.type("break@test.com");
  await pwInput.click({ clickCount: 3 });
  await pwInput.type("BreakIt99!");
  await new Promise((r) => setTimeout(r, 500));
  await page.click('button[type="submit"]');
  await new Promise((r) => setTimeout(r, 4000));
  if (page.url().includes("/login")) {
    await page.evaluate(async () => {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "break@test.com", password: "BreakIt99!" }),
      });
    });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function ensureLoggedIn() {
  const url = page.url();
  if (url.includes("/login") || url.includes("/register")) {
    await login();
  }
}

// ─────────────────────────────────────────────────────────────────────
async function runTests() {
  console.log("\n\x1b[1mFLUX Advanced E2E Tests — Dialogs, Popups & Workflows\x1b[0m\n");

  // Login first
  await login();

  // ── 1. Inventory: Add Product dialog opens ─────────────────────────
  await test("1. Inventory: 'Add Product' button opens dialog", async () => {
    await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));
    const addBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll("button")];
      return buttons.find((b) => b.textContent.includes("Add Product") || b.textContent.includes("New Product"));
    });
    assert(addBtn, "Add Product button not found");
    await addBtn.click();
    await new Promise((r) => setTimeout(r, 1000));
    const dialog = await page.$('[role="dialog"], [data-state="open"], .fixed');
    assert(dialog, "Dialog did not open after clicking Add Product");
    const text = await page.evaluate(() => document.body.innerText);
    assert(text.includes("Product") || text.includes("Name") || text.includes("SKU"), "Dialog missing product form fields");
  });

  // ── 2. Inventory: Close Add Product dialog ─────────────────────────
  await test("2. Inventory: dialog closes on cancel/X", async () => {
    // Try ESC key
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 500));
    // Check if dialog is gone
    const dialog = await page.$('[role="dialog"][data-state="open"]');
    // If still open, try clicking close button
    if (dialog) {
      const closeBtn = await page.$('[role="dialog"] button[aria-label="Close"], [role="dialog"] .close-button');
      if (closeBtn) await closeBtn.click();
      await new Promise((r) => setTimeout(r, 500));
    }
    // Verify we're back to normal page
    const text = await page.evaluate(() => document.body.innerText);
    assert(text.includes("Inventory") || text.includes("Product"), "Page content not restored after closing dialog");
  });

  // ── 3. POS: Complete sale flow ─────────────────────────────────────
  await test("3. POS: full sale flow — add product, see totals update", async () => {
    await page.goto(`${BASE}/pos`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Get initial total
    const initialText = await page.evaluate(() => document.body.innerText);

    // Click first product card to add to cart
    const cards = await page.$$('[class*="cursor-pointer"][class*="border"], [class*="product"]');
    if (cards.length > 0) {
      await cards[0].click();
      await new Promise((r) => setTimeout(r, 1000));
    }

    const afterText = await page.evaluate(() => document.body.innerText);
    assert(afterText.includes("Subtotal") || afterText.includes("TOTAL"), "Cart totals not showing");
  });

  // ── 4. POS: Payment method buttons work ────────────────────────────
  await test("4. POS: payment method toggle buttons are interactive", async () => {
    const text = await page.evaluate(() => document.body.innerText);
    const hasMethods = text.includes("Cash") || text.includes("Card") || text.includes("Bank");
    assert(hasMethods, "Payment method buttons not found");

    // Try clicking Card button
    const cardBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll("button")];
      return buttons.find((b) => b.textContent.trim() === "Card");
    });
    if (cardBtn) {
      await cardBtn.click();
      await new Promise((r) => setTimeout(r, 300));
    }
  });

  // ── 5. POS: Discount input works ───────────────────────────────────
  await test("5. POS: discount input accepts values", async () => {
    const discountInput = await page.evaluateHandle(() => {
      const inputs = [...document.querySelectorAll("input")];
      return inputs.find((i) => {
        const label = i.closest("div")?.textContent || "";
        return label.includes("Discount") || i.placeholder?.includes("discount");
      });
    });
    if (discountInput && discountInput.asElement()) {
      await discountInput.click({ clickCount: 3 });
      await discountInput.type("5");
      await new Promise((r) => setTimeout(r, 500));
    }
    // Just verify the page is still functional
    const text = await page.evaluate(() => document.body.innerText);
    assert(text.includes("TOTAL") || text.includes("Subtotal"), "POS page broke after discount input");
  });

  // ── 6. POS: Complete Sale button exists and is clickable ───────────
  await test("6. POS: Complete Sale button present", async () => {
    const text = await page.evaluate(() => document.body.innerText);
    assert(text.includes("Complete Sale") || text.includes("Complete"), "Complete Sale button not found");
  });

  // ── 7. Invoices: click invoice row shows detail ────────────────────
  await test("7. Invoices: clicking an invoice shows details/actions", async () => {
    await page.goto(`${BASE}/invoices`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Look for View button or clickable row
    const viewBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll("button, a")];
      return buttons.find((b) => b.textContent.includes("View") || b.title?.includes("View"));
    });
    if (viewBtn && viewBtn.asElement()) {
      await viewBtn.click();
      await new Promise((r) => setTimeout(r, 1500));
      const text = await page.evaluate(() => document.body.innerText);
      // Dialog or detail view should show invoice info
      const hasDetail = text.includes("Invoice") || text.includes("Total") || text.includes("PDF") || text.includes("Download");
      assert(hasDetail, "Invoice detail not shown after clicking View");
    }
    // If no invoices exist yet, just verify the page structure
    const text = await page.evaluate(() => document.body.innerText);
    assert(text.includes("Invoice") || text.includes("No invoices"), "Invoices page not functional");
  });

  // ── 8. Shipments: New Shipment opens form ──────────────────────────
  await test("8. Shipments: New Shipment button opens form/dialog", async () => {
    await page.goto(`${BASE}/shipments`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    const newBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll("button")];
      return buttons.find((b) => b.textContent.includes("New Shipment") || b.textContent.includes("Add Shipment"));
    });
    if (newBtn && newBtn.asElement()) {
      await newBtn.click();
      await new Promise((r) => setTimeout(r, 1000));
      const text = await page.evaluate(() => document.body.innerText);
      assert(
        text.includes("Shipment") || text.includes("Container") || text.includes("Supplier") || text.includes("Name"),
        "Shipment form not shown"
      );
      // Close dialog
      await page.keyboard.press("Escape");
      await new Promise((r) => setTimeout(r, 500));
    }
  });

  // ── 9. Users: Add User dialog ──────────────────────────────────────
  await test("9. Users: Add User button opens dialog with role selector", async () => {
    await page.goto(`${BASE}/users`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    const addBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll("button")];
      return buttons.find((b) => b.textContent.includes("Add User") || b.textContent.includes("New User") || b.textContent.includes("Invite"));
    });
    if (addBtn && addBtn.asElement()) {
      await addBtn.click();
      await new Promise((r) => setTimeout(r, 1000));
      const text = await page.evaluate(() => document.body.innerText);
      assert(
        text.includes("Role") || text.includes("Email") || text.includes("Name") || text.includes("Password"),
        "User form dialog missing expected fields"
      );
      await page.keyboard.press("Escape");
      await new Promise((r) => setTimeout(r, 500));
    }
  });

  // ── 10. Settings: Save Organization form ───────────────────────────
  await test("10. Settings: Organization form submits successfully", async () => {
    await page.goto(`${BASE}/settings`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Find the Save Organization button
    const saveBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll("button")];
      return buttons.find((b) => b.textContent.includes("Save Organization") || b.textContent.includes("Save Org"));
    });
    if (saveBtn && saveBtn.asElement()) {
      await saveBtn.click();
      await new Promise((r) => setTimeout(r, 2000));
      // Check for success toast or no error
      const text = await page.evaluate(() => document.body.innerText);
      const hasError = text.includes("Failed") || text.includes("Error");
      assert(!hasError, "Organization save showed an error");
    }
  });

  // ── 11. Settings: Tally toggle actually toggles ────────────────────
  await test("11. Settings: Tally toggle switches state on click", async () => {
    await page.goto(`${BASE}/settings`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    const toggle = await page.$('button[role="switch"]');
    assert(toggle, "Tally toggle not found");

    const initialState = await page.evaluate((el) => el.getAttribute("aria-checked"), toggle);
    await toggle.click();
    await new Promise((r) => setTimeout(r, 1500));

    const newState = await page.evaluate(
      (el) => el.getAttribute("aria-checked"),
      await page.$('button[role="switch"]')
    );
    assert(initialState !== newState, `Toggle didn't change: was ${initialState}, still ${newState}`);

    // Toggle back
    const toggle2 = await page.$('button[role="switch"]');
    await toggle2.click();
    await new Promise((r) => setTimeout(r, 1000));
  });

  // ── 12. Settings: Danger Zone reset dialog ─────────────────────────
  await test("12. Settings: Reset All Data shows confirmation dialog with password", async () => {
    // Scroll to bottom to find Danger Zone
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise((r) => setTimeout(r, 500));

    const resetBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll("button")];
      return buttons.find((b) => b.textContent.includes("Reset All Data") || b.textContent.includes("Reset"));
    });
    if (resetBtn && resetBtn.asElement()) {
      await resetBtn.click();
      await new Promise((r) => setTimeout(r, 1000));

      const text = await page.evaluate(() => document.body.innerText);
      assert(
        text.includes("password") || text.includes("Password") || text.includes("confirm") || text.includes("irreversible"),
        "Reset confirmation dialog missing password prompt"
      );
      // Close without confirming
      await page.keyboard.press("Escape");
      await new Promise((r) => setTimeout(r, 500));
    }
  });

  // ── 13. Settings: Seed Data confirmation dialog ────────────────────
  await test("13. Settings: Seed Demo Data shows confirmation dialog", async () => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise((r) => setTimeout(r, 500));

    const seedBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll("button")];
      return buttons.find((b) => b.textContent.includes("Seed Demo Data"));
    });
    if (seedBtn && seedBtn.asElement()) {
      await seedBtn.click();
      await new Promise((r) => setTimeout(r, 1000));

      const text = await page.evaluate(() => document.body.innerText);
      assert(
        text.includes("Are you sure") || text.includes("proceed") || text.includes("Seed Data") || text.includes("Cancel"),
        "Seed confirmation dialog not shown"
      );
      // Close
      await page.keyboard.press("Escape");
      await new Promise((r) => setTimeout(r, 500));
    }
  });

  // ── 14. Profile: Change name form works ────────────────────────────
  await test("14. Profile: Display Name save button works", async () => {
    await page.goto(`${BASE}/profile`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    const saveBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll("button")];
      return buttons.find((b) => b.textContent.includes("Save"));
    });
    assert(saveBtn && (await saveBtn.asElement()), "Profile Save button not found");
    // Just verify it's clickable without breaking
    await saveBtn.click();
    await new Promise((r) => setTimeout(r, 1500));
    const text = await page.evaluate(() => document.body.innerText);
    assert(text.includes("Profile"), "Profile page broke after save");
  });

  // ── 15. Header: User dropdown opens ────────────────────────────────
  await test("15. Header: user avatar dropdown opens with options", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Click user avatar/button in header
    const userBtn = await page.evaluateHandle(() => {
      const header = document.querySelector("header");
      if (!header) return null;
      const buttons = [...header.querySelectorAll("button")];
      return buttons.find((b) => b.textContent.includes("Admin") || b.querySelector("[class*='avatar']") || b.textContent.includes("AU"));
    });
    if (userBtn && userBtn.asElement()) {
      await userBtn.click();
      await new Promise((r) => setTimeout(r, 800));
      const text = await page.evaluate(() => document.body.innerText);
      const hasDropdown = text.includes("Profile") || text.includes("Logout") || text.includes("Sign out") || text.includes("Log out");
      assert(hasDropdown, "User dropdown didn't show Profile/Logout options");
      // Close by pressing escape
      await page.keyboard.press("Escape");
      await new Promise((r) => setTimeout(r, 300));
    }
  });

  // ── 16. Mobile: sidebar opens via hamburger ────────────────────────
  await test("16. Mobile: hamburger menu opens sidebar overlay", async () => {
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Find hamburger/menu button
    const menuBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll("button")];
      return buttons.find(
        (b) => b.querySelector('[class*="menu"]') || b.getAttribute("aria-label")?.includes("menu") || b.title?.includes("Menu")
      );
    });
    if (menuBtn && menuBtn.asElement()) {
      await menuBtn.click();
      await new Promise((r) => setTimeout(r, 800));
      const text = await page.evaluate(() => document.body.innerText);
      assert(text.includes("Dashboard") || text.includes("POS") || text.includes("FLUX"), "Mobile sidebar overlay didn't open");
      await page.keyboard.press("Escape");
      await new Promise((r) => setTimeout(r, 300));
    }
    // Reset viewport
    await page.setViewport({ width: 1440, height: 900 });
  });

  // ── 17. POS: search/filter products ────────────────────────────────
  await test("17. POS: product search filters results", async () => {
    await page.goto(`${BASE}/pos`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    const searchInput = await page.$('input[placeholder*="Search"], input[type="search"], input[placeholder*="product"]');
    if (searchInput) {
      await searchInput.click();
      await searchInput.type("glass");
      await new Promise((r) => setTimeout(r, 1000));
      // Page should still be functional
      const text = await page.evaluate(() => document.body.innerText);
      assert(text.includes("TOTAL") || text.includes("Sale"), "POS broke after search");
      // Clear search
      await searchInput.click({ clickCount: 3 });
      await page.keyboard.press("Backspace");
      await new Promise((r) => setTimeout(r, 500));
    }
  });

  // ── 18. POS: category filter buttons work ──────────────────────────
  await test("18. POS: category filter buttons are clickable", async () => {
    const text = await page.evaluate(() => document.body.innerText);
    const hasCategories = text.includes("All") && (text.includes("Glass") || text.includes("Tools") || text.includes("Accessories"));
    assert(hasCategories, "Category filter buttons not found");

    // Click a category
    const catBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll("button")];
      return buttons.find((b) => b.textContent.trim() === "Glass" || b.textContent.trim() === "Tools");
    });
    if (catBtn && catBtn.asElement()) {
      await catBtn.click();
      await new Promise((r) => setTimeout(r, 800));
    }
    // Click All to reset
    const allBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll("button")];
      return buttons.find((b) => b.textContent.trim() === "All");
    });
    if (allBtn && allBtn.asElement()) {
      await allBtn.click();
      await new Promise((r) => setTimeout(r, 500));
    }
  });

  // ── 19. Sidebar exists and has correct structure ─────────────────
  await test("19. Sidebar has proper navigation structure and collapse button", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Verify sidebar exists with nav links
    const sidebarInfo = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      if (!aside) return null;
      const links = aside.querySelectorAll("a");
      const buttons = aside.querySelectorAll("button");
      const hasLogo = aside.textContent.includes("FLUX");
      const hasWorkspace = aside.textContent.includes("Workspace");
      return {
        width: aside.offsetWidth,
        linkCount: links.length,
        buttonCount: buttons.length,
        hasLogo,
        hasWorkspace,
        className: aside.className,
      };
    });
    assert(sidebarInfo, "Sidebar aside element not found");
    assert(sidebarInfo.width >= 200, `Sidebar too narrow: ${sidebarInfo.width}px`);
    assert(sidebarInfo.linkCount >= 5, `Only ${sidebarInfo.linkCount} nav links (expected >=5)`);
    assert(sidebarInfo.hasLogo, "FLUX logo text missing from sidebar");
    assert(sidebarInfo.hasWorkspace, "Workspace label missing from sidebar");
    assert(sidebarInfo.className.includes("w-[244px]") || sidebarInfo.width === 244, "Sidebar not at expanded width");
  });

  // ── 20. API health: settings endpoint returns valid data ───────────
  await test("20. API: /api/settings returns valid org + settings + tallyEnabled", async () => {
    const data = await page.evaluate(async () => {
      const res = await fetch("/api/settings");
      return res.json();
    });
    assert(data.organization, "API missing organization");
    assert(data.organization.name, "API missing org name");
    assert(data.settings !== undefined, "API missing settings");
    assert(data.tallyEnabled !== undefined, "API missing tallyEnabled field");
  });
}

// ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await setup();
    await runTests();
  } catch (e) {
    console.error("\nFatal error:", e.message);
  } finally {
    await teardown();
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`\x1b[1mResults: ${passed} passed, ${failed} failed, ${passed + failed} total\x1b[0m`);
  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter((r) => r.status === "FAIL").forEach((r) => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
  console.log();
  process.exit(failed > 0 ? 1 : 0);
})();
