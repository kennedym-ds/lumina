/** Capture the 404 (page load) and 400 (regression) with full request/response detail. */
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

const fails = [];
page.on("response", async (r) => {
  if (r.status() >= 400) {
    let body = "";
    try { body = (await r.text()).slice(0, 300); } catch {}
    let reqBody = "";
    try { reqBody = (r.request().postData() || "").slice(0, 300); } catch {}
    fails.push({ status: r.status(), method: r.request().method(), url: r.url(), reqBody, body });
  }
});
page.on("requestfailed", (req) => fails.push({ status: "FAILED", method: req.method(), url: req.url(), body: req.failure()?.errorText }));

console.log("=== PAGE LOAD ===");
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

console.log("=== LOAD DATASET + REGRESSION ===");
await page.locator("article").filter({ hasText: "Palmer Penguins" }).getByRole("button", { name: "Load" }).click();
await page.waitForSelector('button:has-text("Data")', { timeout: 20000 });
await page.getByRole("button", { name: /Regression/i }).click();
await page.waitForTimeout(1500);
// configure a regression to trigger the 400
try {
  // dependent
  const depSelect = page.locator("select").first();
  if (await depSelect.count()) { await depSelect.selectOption({ label: "body_mass_g" }).catch(() => {}); }
  await page.waitForTimeout(500);
  // check a couple independents
  const checks = page.locator('input[type="checkbox"]');
  const n = await checks.count();
  for (let i = 0; i < Math.min(2, n); i++) { await checks.nth(i).check().catch(() => {}); await page.waitForTimeout(300); }
  await page.waitForTimeout(800);
  const fit = page.getByRole("button", { name: /fit model/i });
  if (await fit.count()) { await fit.click().catch(() => {}); await page.waitForTimeout(2000); }
} catch (e) { console.log("regression config note:", e.message); }

await page.waitForTimeout(1000);
console.log("\n=== 4xx/5xx / FAILED REQUESTS (" + fails.length + ") ===");
fails.forEach((f) => {
  console.log(`\n${f.status} ${f.method} ${f.url}`);
  if (f.reqBody) console.log("  req:  " + f.reqBody);
  if (f.body) console.log("  resp: " + f.body);
});

await browser.close();
