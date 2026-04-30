const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE = "http://localhost:3000";
const OUT_LIGHT = path.join(__dirname, "runtime", "screenshots", "light");
const OUT_DARK = path.join(__dirname, "runtime", "screenshots", "dark");

const VIEWPORT = { width: 1440, height: 900 };

const PAGES = [
  { name: "01-landing", path: "/", noAuth: true },
  { name: "02-login", path: "/login", noAuth: true },
  { name: "03-register", path: "/register", noAuth: true },
  { name: "04-dashboard", path: "/dashboard" },
  { name: "05-pos", path: "/pos" },
  { name: "06-inventory", path: "/inventory" },
  { name: "07-shipments", path: "/shipments" },
  { name: "08-invoices", path: "/invoices" },
  { name: "09-accounting", path: "/accounting" },
  { name: "10-receivables", path: "/receivables" },
  { name: "11-reports", path: "/reports" },
  { name: "12-tally", path: "/tally" },
  { name: "13-users", path: "/users" },
  { name: "14-settings", path: "/settings" },
  { name: "15-profile", path: "/profile" },
];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.evaluate(() => {
    document.querySelector('input[type="email"]').value = "";
    document.querySelector('input[type="password"]').value = "";
  });
  await page.type('input[type="email"]', "admin@flux.com");
  await page.type('input[type="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(t);
    document.documentElement.style.colorScheme = t;
    localStorage.setItem("theme", t);
  }, theme);
  await new Promise((r) => setTimeout(r, 500));
}

// Dismiss the email verification banner if present
async function dismissBanner(page) {
  await page.evaluate(() => {
    const banner = document.querySelector('[data-slot="email-banner"]');
    if (banner) banner.remove();
    // Also try to find the close button on the banner
    const closeBtn = document.querySelector('.email-verify-banner button, [aria-label="Dismiss"]');
    if (closeBtn) closeBtn.click();
  });
  await new Promise((r) => setTimeout(r, 300));
}

async function takeInvoiceDetail(page, outDir, theme) {
  try {
    // Navigate to invoices, click first invoice to open detail
    await page.goto(`${BASE}/invoices`, { waitUntil: "networkidle2", timeout: 15000 });
    await setTheme(page, theme);
    await new Promise((r) => setTimeout(r, 1500));

    // Click the first invoice row
    const firstRow = await page.$("table tbody tr");
    if (firstRow) {
      await firstRow.click();
      await new Promise((r) => setTimeout(r, 1500));
      await page.screenshot({ path: path.join(outDir, "16-invoice-detail.png"), fullPage: false });
      console.log(`  [${theme}] 16-invoice-detail`);

      // Close the dialog
      const closeBtn = await page.$('[data-slot="dialog-close"]');
      if (closeBtn) await closeBtn.click();
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (e) {
    console.log(`  [${theme}] SKIP invoice-detail: ${e.message}`);
  }
}

async function takeScreenshots(theme) {
  const outDir = theme === "light" ? OUT_LIGHT : OUT_DARK;
  fs.mkdirSync(outDir, { recursive: true });

  // Clean old mobile screenshots
  const existing = fs.readdirSync(outDir);
  for (const f of existing) {
    if (f.includes("-mobile")) {
      fs.unlinkSync(path.join(outDir, f));
    }
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  // Take unauthenticated pages (desktop only)
  for (const pg of PAGES.filter((p) => p.noAuth)) {
    try {
      await page.goto(`${BASE}${pg.path}`, { waitUntil: "networkidle2", timeout: 15000 });
      await setTheme(page, theme);
      await new Promise((r) => setTimeout(r, 1000));
      await page.screenshot({ path: path.join(outDir, `${pg.name}.png`), fullPage: false });
      console.log(`  [${theme}] ${pg.name}`);
    } catch (e) {
      console.log(`  [${theme}] SKIP ${pg.name}: ${e.message}`);
    }
  }

  // Login
  await login(page);
  await setTheme(page, theme);

  // Take authenticated pages (desktop only)
  for (const pg of PAGES.filter((p) => !p.noAuth)) {
    try {
      await page.goto(`${BASE}${pg.path}`, { waitUntil: "networkidle2", timeout: 15000 });
      await setTheme(page, theme);
      await new Promise((r) => setTimeout(r, 1500));
      await dismissBanner(page);
      await page.screenshot({ path: path.join(outDir, `${pg.name}.png`), fullPage: false });
      console.log(`  [${theme}] ${pg.name}`);
    } catch (e) {
      console.log(`  [${theme}] SKIP ${pg.name}: ${e.message}`);
    }
  }

  // Invoice detail dialog screenshot
  await takeInvoiceDetail(page, outDir, theme);

  await browser.close();
}

(async () => {
  console.log("Taking LIGHT mode screenshots (desktop only)...");
  await takeScreenshots("light");
  console.log("\nTaking DARK mode screenshots (desktop only)...");
  await takeScreenshots("dark");
  console.log("\nDone! Screenshots saved to runtime/screenshots/");
})();
