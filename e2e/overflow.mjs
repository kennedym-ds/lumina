/** Build a chart, then report horizontal overflow + the widest offending elements. */
import { chromium } from "playwright";
const BASE = "http://localhost:1420";

async function dragTo(page, source, target) {
  const s = await source.boundingBox(); const t = await target.boundingBox();
  const sx = s.x + s.width / 2, sy = s.y + s.height / 2, tx = t.x + t.width / 2, ty = t.y + t.height / 2;
  await page.mouse.move(sx, sy); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(sx + ((tx - sx) * i) / 12, sy + ((ty - sy) * i) / 12); await page.waitForTimeout(15); }
  await page.mouse.up();
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// load penguins
await page.locator("article").filter({ hasText: "Palmer Penguins" }).getByRole("button", { name: "Load" }).click();
await page.waitForSelector('button:has-text("Data")', { timeout: 20000 });
// charts tab
await page.getByRole("button", { name: /Charts/i }).click();
await page.locator("aside.rounded-lg h2").filter({ hasText: "Variables" }).waitFor({ state: "visible", timeout: 12000 });
// scatter + drag
await page.getByRole("button", { name: /^Scatter/i }).first().click();
await page.waitForTimeout(300);
const xShelf = page.getByText(/X Axis/i).first().locator("xpath=ancestor::*[1]");
const yShelf = page.getByText(/Y Axis/i).first().locator("xpath=ancestor::*[1]");
await dragTo(page, page.getByText("bill_length_mm").first(), page.locator("text=Drop variable here").first());
await page.waitForTimeout(400);
await dragTo(page, page.getByText("bill_depth_mm").first(), page.locator("text=Drop variable here").first());
await page.waitForTimeout(1500);

const report = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const docOverflow = document.documentElement.scrollWidth - vw;
  // find elements whose right edge exceeds viewport
  const offenders = [];
  document.querySelectorAll("*").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1) {
      offenders.push({
        sel: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ").slice(0, 3).join(".") : ""),
        right: Math.round(r.right), width: Math.round(r.width),
      });
    }
  });
  // dedupe by selector, keep widest
  const bySel = {};
  offenders.forEach((o) => { if (!bySel[o.sel] || o.width > bySel[o.sel].width) bySel[o.sel] = o; });
  return { vw, docOverflow, offenders: Object.values(bySel).sort((a, b) => b.right - a.right).slice(0, 12) };
});

console.log("viewport width:", report.vw);
console.log("document horizontal overflow:", report.docOverflow, "px", report.docOverflow > 1 ? ">> OVERFLOW" : ">> ok");
console.log("\nelements extending past viewport (right edge > vw):");
report.offenders.forEach((o) => console.log(`  right=${o.right} w=${o.width}  ${o.sel}`));

await page.screenshot({ path: "e2e/screenshots/overflow.png" });
await browser.close();
