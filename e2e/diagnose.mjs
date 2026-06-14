/**
 * Focused diagnostics for three reported bugs:
 *   1. "clicked iris got penguins"
 *   2. "sidebar scrollbars do nothing"
 *   3. "graphs don't fit"
 *
 * Run: node e2e/diagnose.mjs   (needs dev server :1420 + backend :8089)
 */
import { chromium } from "playwright";

const BASE = "http://localhost:1420";

const consoleErrors = [];
const netErrors = [];

function log(s) { console.log(s); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + e.message));
page.on("response", (r) => { if (r.status() >= 400) netErrors.push(`${r.status()} ${r.request().method()} ${r.url()}`); });

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

// ── 1. iris vs penguins ──────────────────────────────────────────────
log("\n=== 1. LOAD IRIS ===");
// find the Iris card and click its Load button
const irisCard = page.locator("article", { hasText: /Iris/i }).first();
await irisCard.scrollIntoViewIfNeeded();
log("iris card text: " + JSON.stringify((await irisCard.innerText()).replace(/\n/g, " | ")));
await irisCard.getByRole("button", { name: /load/i }).click();
await page.waitForTimeout(2000);

// dataset label in header
const header = await page.locator("header").innerText().catch(() => "");
const fileLabel = (header.match(/[\w-]+\.csv/) || ["(none)"])[0];
log("header filename: " + fileLabel);

// what columns are shown? (data table headers or variable list)
const bodyText = await page.locator("body").innerText();
const hasIrisCols = /sepal_length|petal_length/i.test(bodyText);
const hasPenguinCols = /bill_length_mm|flipper_length_mm/i.test(bodyText);
log("iris columns visible (sepal/petal): " + hasIrisCols);
log("penguin columns visible (bill/flipper): " + hasPenguinCols);
log(hasIrisCols && !hasPenguinCols ? ">> IRIS shown correctly" : hasPenguinCols ? ">> BUG: PENGUIN data shown after clicking Iris" : ">> unclear");
await page.screenshot({ path: "e2e/screenshots/diag-1-iris.png" });

// ── 2. sidebar scroll ────────────────────────────────────────────────
log("\n=== 2. SIDEBAR SCROLL ===");
const aside = page.locator("aside").first();
const asideInfo = await aside.evaluate((el) => ({
  scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
  overflowY: getComputedStyle(el).overflowY, scrollable: el.scrollHeight > el.clientHeight,
})).catch(() => null);
log("aside: " + JSON.stringify(asideInfo));
if (asideInfo?.scrollable) {
  await aside.evaluate((el) => { el.scrollTop = 9999; });
  const after = await aside.evaluate((el) => el.scrollTop);
  log("scrollTop after scroll-to-bottom: " + after + (after > 0 ? " >> SCROLL WORKS" : " >> SCROLL BROKEN"));
} else {
  log(">> aside content fits (no scroll needed at this height) or aside not found");
}

// ── 3. chart fit ─────────────────────────────────────────────────────
log("\n=== 3. CHART FIT ===");
// open charts/EDA tab
const edaTab = page.getByRole("button", { name: /chart|eda|explore/i }).first();
if (await edaTab.count()) { await edaTab.click(); await page.waitForTimeout(800); }
// pick scatter then drag two vars (reuse simple approach: click a gallery preset if present)
const scatterBtn = page.getByRole("button", { name: /^scatter/i }).first();
if (await scatterBtn.count()) { await scatterBtn.click(); await page.waitForTimeout(500); }
await page.waitForTimeout(1500);
const plot = page.locator(".js-plotly-plot").first();
if (await plot.count()) {
  const fit = await plot.evaluate((el) => {
    const parent = el.parentElement;
    return {
      plotW: el.clientWidth, plotH: el.clientHeight,
      parentW: parent.clientWidth, parentH: parent.clientHeight,
      overflowX: el.scrollWidth > parent.clientWidth + 2,
      overflowY: el.scrollHeight > parent.clientHeight + 2,
    };
  });
  log("chart fit: " + JSON.stringify(fit));
  log(fit.overflowX || fit.overflowY ? ">> CHART OVERFLOWS container" : ">> chart fits container");
} else {
  log("no plotly chart rendered (need variables assigned)");
}
await page.screenshot({ path: "e2e/screenshots/diag-3-chart.png" });

// ── errors summary ───────────────────────────────────────────────────
log("\n=== CONSOLE ERRORS (" + consoleErrors.length + ") ===");
[...new Set(consoleErrors)].slice(0, 15).forEach((e) => log("  " + e));
log("\n=== NETWORK 4xx/5xx (" + netErrors.length + ") ===");
[...new Set(netErrors)].slice(0, 15).forEach((e) => log("  " + e));

await browser.close();
