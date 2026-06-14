/** Capture empty-state, data-loaded, and chart screenshots for UI review.
 * Usage: node e2e/shots.mjs <prefix>
 */
import { chromium } from "playwright";
const BASE = "http://localhost:1420";
const prefix = process.argv[2] || "ui";

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
await page.waitForTimeout(1000);
await page.screenshot({ path: `e2e/screenshots/${prefix}-1-empty.png` });

// load penguins
await page.getByRole("button").filter({ hasText: "Palmer Penguins" }).click();
await page.waitForSelector('button:has-text("Data")', { timeout: 20000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `e2e/screenshots/${prefix}-2-data.png` });

// charts tab + build a scatter
await page.getByRole("button", { name: /Charts/i }).click();
await page.locator("aside.rounded-lg h2").filter({ hasText: "Variables" }).waitFor({ state: "visible", timeout: 12000 });
await page.getByRole("button", { name: /^Scatter/i }).first().click();
await page.waitForTimeout(300);
await dragTo(page, page.getByText("bill_length_mm").first(), page.locator("text=Drop variable here").first());
await page.waitForTimeout(400);
await dragTo(page, page.getByText("bill_depth_mm").first(), page.locator("text=Drop variable here").first());
await page.waitForTimeout(1500);
await page.screenshot({ path: `e2e/screenshots/${prefix}-3-chart.png` });

console.log("saved", prefix, "screenshots");
await browser.close();
