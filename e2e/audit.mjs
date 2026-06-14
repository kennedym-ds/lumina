/** Verify the data-tab sidebar width and audit every platform tab for graphs
 * overflowing their container or the viewport. */
import { chromium } from "playwright";
const BASE = "http://localhost:1420";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.getByRole("button").filter({ hasText: "Palmer Penguins" }).click();
await page.waitForSelector('button:has-text("Data")', { timeout: 20000 });
await page.waitForTimeout(800);

// 1. data-tab sidebar width
const sidebar = await page.locator('[data-panel="sidebar"], aside').first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { width: Math.round(r.width) };
}).catch(() => null);
console.log("data-tab sidebar width:", sidebar?.width, "px", (sidebar?.width ?? 0) > 150 ? ">> OK" : ">> TOO NARROW");

// 2. walk every platform tab, render its default content, check for overflow
const tabs = ["Profile", "Distribution", "Inference", "Regression", "Dashboard", "Charts"];
for (const tab of tabs) {
  try {
    await page.getByRole("button", { name: new RegExp(tab, "i") }).first().click();
    await page.waitForTimeout(1500);
    const report = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const docOverflow = document.documentElement.scrollWidth - vw;
      // any plotly graph wider than its parent?
      const graphIssues = [];
      document.querySelectorAll(".js-plotly-plot, svg.main-svg, canvas").forEach((el) => {
        const p = el.parentElement;
        if (!p) return;
        if (el.scrollWidth > p.clientWidth + 2 || el.getBoundingClientRect().right > vw + 2) {
          graphIssues.push({ tag: el.tagName.toLowerCase() + (el.className?.toString?.().split(" ")[0] ?? ""), w: Math.round(el.getBoundingClientRect().width), parentW: p.clientWidth });
        }
      });
      return { docOverflow, graphCount: document.querySelectorAll(".js-plotly-plot").length, graphIssues };
    });
    const status = report.docOverflow <= 1 && report.graphIssues.length === 0 ? "OK" : "OVERFLOW";
    console.log(`tab ${tab}: docOverflow=${report.docOverflow}px graphs=${report.graphCount} issues=${report.graphIssues.length} >> ${status}`);
    if (report.graphIssues.length) console.log("   ", JSON.stringify(report.graphIssues.slice(0, 4)));
    await page.screenshot({ path: `e2e/screenshots/audit-${tab.toLowerCase()}.png` });
  } catch (e) {
    console.log(`tab ${tab}: error ${e.message.slice(0, 80)}`);
  }
}
await browser.close();
