const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE = "http://localhost:3000";
const OUT_LIGHT = path.join(__dirname, "runtime", "screenshots", "light");
const OUT_DARK = path.join(__dirname, "runtime", "screenshots", "dark");

const VIEWPORT_DESKTOP = { width: 1440, height: 900 };
const VIEWPORT_MOBILE = { width: 390, height: 844 };

const PAGES = [
  { name: "01-login", path: "/login", noAuth: true },
  { name: "02-register", path: "/register", noAuth: true },
  { name: "03-forgot-password", path: "/forgot-password", noAuth: true },
  { name: "04-dashboard", path: "/" },
  { name: "05-pos", path: "/pos" },
  { name: "06-inventory", path: "/inventory" },
  { name: "07-shipments", path: "/shipments" },
  { name: "08-invoices", path: "/invoices" },
  { name: "09-accounting", path: "/accounting" },
  { name: "10-reports", path: "/reports" },
  { name: "11-tally", path: "/tally" },
  { name: "12-users", path: "/users" },
  { name: "13-settings", path: "/settings" },
  { name: "14-profile", path: "/profile" },
];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.evaluate(() => {
    document.querySelector('input[type="email"]').value = "";
    document.querySelector('input[type="password"]').value = "";
  });
  await page.type('input[type="email"]', "admin@flux.com");
  await page.type('input[type="password"]', "admin123");
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

async function takeScreenshots(theme) {
  const outDir = theme === "light" ? OUT_LIGHT : OUT_DARK;
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT_DESKTOP);

  // Take unauthenticated pages first
  for (const pg of PAGES.filter((p) => p.noAuth)) {
    try {
      await page.goto(`${BASE}${pg.path}`, { waitUntil: "networkidle2", timeout: 15000 });
      await setTheme(page, theme);
      await new Promise((r) => setTimeout(r, 1000));
      await page.screenshot({ path: path.join(outDir, `${pg.name}-desktop.png`), fullPage: false });
      console.log(`  [${theme}] ${pg.name}-desktop`);

      await page.setViewport(VIEWPORT_MOBILE);
      await new Promise((r) => setTimeout(r, 500));
      await page.screenshot({ path: path.join(outDir, `${pg.name}-mobile.png`), fullPage: false });
      console.log(`  [${theme}] ${pg.name}-mobile`);
      await page.setViewport(VIEWPORT_DESKTOP);
    } catch (e) {
      console.log(`  [${theme}] SKIP ${pg.name}: ${e.message}`);
    }
  }

  // Login
  await login(page);
  await setTheme(page, theme);

  // Take authenticated pages
  for (const pg of PAGES.filter((p) => !p.noAuth)) {
    try {
      await page.goto(`${BASE}${pg.path}`, { waitUntil: "networkidle2", timeout: 15000 });
      await setTheme(page, theme);
      await new Promise((r) => setTimeout(r, 1500));
      await page.screenshot({ path: path.join(outDir, `${pg.name}-desktop.png`), fullPage: false });
      console.log(`  [${theme}] ${pg.name}-desktop`);

      await page.setViewport(VIEWPORT_MOBILE);
      await new Promise((r) => setTimeout(r, 500));
      await page.screenshot({ path: path.join(outDir, `${pg.name}-mobile.png`), fullPage: false });
      console.log(`  [${theme}] ${pg.name}-mobile`);
      await page.setViewport(VIEWPORT_DESKTOP);
    } catch (e) {
      console.log(`  [${theme}] SKIP ${pg.name}: ${e.message}`);
    }
  }

  await browser.close();
}

(async () => {
  console.log("Taking LIGHT mode screenshots...");
  await takeScreenshots("light");
  console.log("\nTaking DARK mode screenshots...");
  await takeScreenshots("dark");
  console.log("\nDone! Screenshots saved to runtime/screenshots/");
})();
