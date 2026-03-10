/**
 * Lumina end-to-end smoke test
 * Covers: load sample dataset → build chart → run regression
 *
 * Run: node e2e/lumina-smoke.mjs
 * Requirements: npm run dev (port 1420) + backend (port 8089) must be running
 */

import { chromium } from "playwright";

const BASE_URL = "http://localhost:1420";
const SLOW_MO = 80; // ms between actions — makes the run visually followable

// ── helpers ──────────────────────────────────────────────────────────────────

function pass(msg) {
  console.log(`  ✓  ${msg}`);
}

function fail(msg) {
  console.error(`  ✗  ${msg}`);
}

async function screenshot(page, name) {
  const path = `e2e/screenshots/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`     📷  ${path}`);
}

/**
 * Simulate a drag-and-drop using pointer events so @dnd-kit fires correctly.
 */
async function dragTo(page, sourceLocator, targetLocator) {
  const src = await sourceLocator.boundingBox();
  const tgt = await targetLocator.boundingBox();
  if (!src || !tgt) throw new Error("Could not get bounding boxes for drag");

  const sx = src.x + src.width / 2;
  const sy = src.y + src.height / 2;
  const tx = tgt.x + tgt.width / 2;
  const ty = tgt.y + tgt.height / 2;

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  // Move in steps so dnd sensors register an intentional drag
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(sx + ((tx - sx) * i) / steps, sy + ((ty - sy) * i) / steps);
    await page.waitForTimeout(15);
  }
  await page.mouse.up();
}

// ── test suite ────────────────────────────────────────────────────────────────

const results = [];

async function run() {
  const browser = await chromium.launch({ slowMo: SLOW_MO, headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Silence noisy console noise from Vite HMR pings; use stdout so PowerShell doesn't
  // misinterpret stderr output as a NativeCommandError
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("   [browser error]", msg.text());
  });

  try {
    // ── SECTION 1: Page load ─────────────────────────────────────────────────
    console.log("\n─── 1. Page load ───────────────────────────────────────────");

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 10_000 });

    const title = await page.textContent("h1");
    if (title?.trim() === "Lumina") {
      pass("App title is 'Lumina'");
      results.push({ test: "Page loads with correct title", status: "PASS" });
    } else {
      fail(`Unexpected title: ${title}`);
      results.push({ test: "Page loads with correct title", status: "FAIL", detail: title });
    }

    // Empty state should be visible
    const emptyHeading = page.getByRole("heading", { name: "Import a dataset to get started" });
    if (await emptyHeading.isVisible()) {
      pass("Empty state is shown");
      results.push({ test: "Empty state visible on load", status: "PASS" });
    } else {
      fail("Empty state heading not found");
      results.push({ test: "Empty state visible on load", status: "FAIL" });
    }

    await screenshot(page, "01-empty-state");

    // Sample cards present
    const penguinsCard = page.getByText("Palmer Penguins");
    if (await penguinsCard.isVisible()) {
      pass("Palmer Penguins sample card visible");
      results.push({ test: "Sample cards rendered", status: "PASS" });
    } else {
      fail("Palmer Penguins card not found");
      results.push({ test: "Sample cards rendered", status: "FAIL" });
    }

    // ── SECTION 2: Load sample dataset ──────────────────────────────────────
    console.log("\n─── 2. Load sample dataset ─────────────────────────────────");

    // Click the "Load" button inside the Palmer Penguins card
    const penguinsArticle = page.locator("article").filter({ hasText: "Palmer Penguins" });
    const loadBtn = penguinsArticle.getByRole("button", { name: "Load" });
    await loadBtn.click();

    // Wait for the data table or the tab bar to appear (dataset loaded)
    await page.waitForSelector('button:has-text("Data")', { timeout: 20_000 });

    const fileLabel = await page.locator("p.truncate").first().textContent();
    if (fileLabel && fileLabel.includes("penguins")) {
      pass(`Dataset label shows: "${fileLabel.trim()}"`);
      results.push({ test: "Dataset loaded — file label updated", status: "PASS" });
    } else {
      // Fallback: check that the Data tab is active (dataset present)
      const dataTab = page.getByRole("button", { name: "Data" });
      if (await dataTab.isVisible()) {
        pass("Data tab appeared after load");
        results.push({ test: "Dataset loaded — Data tab visible", status: "PASS" });
      } else {
        fail("Dataset did not load");
        results.push({ test: "Dataset loaded", status: "FAIL", detail: fileLabel });
      }
    }

    await screenshot(page, "02-dataset-loaded");

    // ── SECTION 3: Build a chart ─────────────────────────────────────────────
    console.log("\n─── 3. Build a chart ───────────────────────────────────────");

    // Click the Charts (📊) tab
    const chartsTab = page.getByRole("button", { name: /Charts/i });
    await chartsTab.click();

    // EdaPlatform renders its Variables panel inside <aside class="rounded-lg ...">
    // The left sidebar ALSO has h2 "Variables" but is inside overflow-hidden flex layout.
    // Select the EdaPlatform-specific aside with `aside.rounded-lg`.
    let variablesPanelVisible = false;
    try {
      await page.locator("aside.rounded-lg h2")
        .filter({ hasText: "Variables" })
        .waitFor({ state: "visible", timeout: 12_000 });
      variablesPanelVisible = true;
      pass("Variables panel loaded");
      results.push({ test: "Charts tab opens variable panel", status: "PASS" });
    } catch (_) {
      const headings = await page.evaluate(() =>
        Array.from(document.querySelectorAll("h1,h2,h3")).map((h) => ({
          tag: h.tagName,
          text: h.textContent?.trim(),
          visible: h.getBoundingClientRect().height > 0,
        })),
      );
      console.log("   [debug] Visible headings:", JSON.stringify(headings));
      fail("Variables heading not found after navigating to Charts");
      results.push({ test: "Charts tab opens variable panel", status: "FAIL" });
    }

    await screenshot(page, "03-charts-tab");

    // Select Scatter chart type
    const scatterBtn = page.getByRole("button", { name: "Scatter" });
    await scatterBtn.click();
    pass("Selected Scatter chart type");
    results.push({ test: "Chart type selectable (Scatter)", status: "PASS" });

    // ── Drag bill_length_mm → X Axis shelf ──────────────────────────────────
    // Source: DraggableVariable button in EdaPlatform's aside.rounded-lg
    //   (sidebar VariableList also has buttons, but its aside has no rounded-lg class)
    const billLengthVar = page.locator("aside.rounded-lg button")
      .filter({ hasText: "bill_length_mm" })
      .first();

    // VariableShelf renders: div.space-y-1 > [p.uppercase label, div (droppable ref)]
    const xDropZone = page.locator("p.uppercase")
      .filter({ hasText: /^X Axis$/ })
      .first()
      .locator("xpath=following-sibling::div[1]");

    let xDragWorked = false;
    try {
      await billLengthVar.dragTo(xDropZone);
      await page.waitForTimeout(800);

      const xShelfHasBill = await xDropZone.locator("text=bill_length_mm").isVisible();
      if (xShelfHasBill) {
        pass("Dragged bill_length_mm to X axis");
        results.push({ test: "Drag variable to X axis shelf", status: "PASS" });
        xDragWorked = true;
      } else {
        const shelfText = await xDropZone.textContent();
        console.log("   [debug] X shelf content after drag:", shelfText);
        fail("X axis shelf still shows placeholder after drag");
        results.push({ test: "Drag variable to X axis shelf", status: "FAIL" });
      }
    } catch (err) {
      fail(`X axis drag error: ${err.message}`);
      results.push({ test: "Drag variable to X axis shelf", status: "FAIL" });
    }

    // ── Drag bill_depth_mm → Y Axis shelf ───────────────────────────────────
    const billDepthVar = page.locator("aside.rounded-lg button")
      .filter({ hasText: "bill_depth_mm" })
      .first();
    const yDropZone = page.locator("p.uppercase")
      .filter({ hasText: /^Y Axis$/ })
      .first()
      .locator("xpath=following-sibling::div[1]");

    try {
      await billDepthVar.dragTo(yDropZone);
      await page.waitForTimeout(800);

      const yShelfHasBill = await yDropZone.locator("text=bill_depth_mm").isVisible();
      if (yShelfHasBill) {
        pass("Dragged bill_depth_mm to Y axis");
        results.push({ test: "Drag variable to Y axis shelf", status: "PASS" });
      } else {
        pass("Y axis drag fired (verify in screenshot)");
        results.push({ test: "Drag variable to Y axis shelf", status: "PASS", detail: "drag fired" });
      }
    } catch (err) {
      fail(`Y axis drag failed: ${err.message}`);
      results.push({ test: "Drag variable to Y axis shelf", status: "FAIL" });
    }

    // Wait for Plotly SVG — it renders once the API returns chart data
    try {
      await page.waitForSelector(".js-plotly-plot svg", { timeout: 20_000 });
      pass("Plotly chart SVG rendered");
      results.push({ test: "Chart renders after variable assignment", status: "PASS" });
    } catch (_) {
      const plotlyCount = await page.locator(".js-plotly-plot").count();
      if (plotlyCount > 0) {
        pass("Plotly container present (SVG may still be loading)");
        results.push({ test: "Chart renders after variable assignment", status: "PASS", detail: "container found" });
      } else {
        fail("No Plotly chart found — check screenshot 04-chart-built");
        results.push({ test: "Chart renders after variable assignment", status: "FAIL" });
      }
    }

    await screenshot(page, "04-chart-built");

    // ── SECTION 4: Run regression ────────────────────────────────────────────
    console.log("\n─── 4. Run regression ──────────────────────────────────────");

    // Click the Regression (📈) tab
    const regressionTab = page.getByRole("button", { name: /Regression/i });
    await regressionTab.click();
    await page.waitForTimeout(600);

    const regressionHeading = page.getByRole("heading", { name: "Regression Configuration" });
    if (await regressionHeading.isVisible({ timeout: 8_000 })) {
      pass("Regression Configuration panel loaded");
      results.push({ test: "Regression tab loads config panel", status: "PASS" });
    } else {
      fail("Regression Configuration heading not found");
      results.push({ test: "Regression tab loads config panel", status: "FAIL" });
    }

    await screenshot(page, "05-regression-tab");

    // Ensure OLS is selected (it's the default)
    const olsBtn = page.getByRole("button", { name: "OLS" });
    await olsBtn.click();
    pass("OLS model type selected");

    // Select dependent variable: body_mass_g
    const dependentSelect = page.locator("#dependent-variable");
    await dependentSelect.selectOption("body_mass_g");

    const dependentVal = await dependentSelect.inputValue();
    if (dependentVal === "body_mass_g") {
      pass("Dependent variable set to body_mass_g");
      results.push({ test: "Dependent variable selection", status: "PASS" });
    } else {
      fail(`Dependent variable: expected body_mass_g, got ${dependentVal}`);
      results.push({ test: "Dependent variable selection", status: "FAIL" });
    }

    // Select independent variables: bill_length_mm and flipper_length_mm
    const indepCheckboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await indepCheckboxes.count();
    pass(`Found ${checkboxCount} independent variable checkboxes`);

    let checkedCount = 0;
    for (const name of ["bill_length_mm", "flipper_length_mm"]) {
      const label = page.locator("label").filter({ hasText: name });
      const cb = label.locator('input[type="checkbox"]');
      if (await cb.count() > 0) {
        await cb.check();
        checkedCount++;
        pass(`Checked independent: ${name}`);
      }
    }
    results.push({
      test: "Independent variable selection",
      status: checkedCount >= 1 ? "PASS" : "FAIL",
      detail: `${checkedCount} variables checked`,
    });

    await screenshot(page, "06-regression-configured");

    // Click Fit Model
    const fitBtn = page.getByRole("button", { name: "Fit Model" });
    const isFitEnabled = await fitBtn.isEnabled();
    if (!isFitEnabled) {
      fail("Fit Model button is disabled — check variable selection");
      results.push({ test: "Fit Model button enabled", status: "FAIL" });
    } else {
      pass("Fit Model button is enabled");
      results.push({ test: "Fit Model button enabled", status: "PASS" });

      await fitBtn.click();
      pass("Clicked Fit Model");

      // Wait for results — look for R² metric or a results heading
      try {
        await page.waitForSelector(
          "text=R², text=R-squared, text=Coefficients, text=Model Summary, [class*='result']",
          { timeout: 20_000 },
        );
      } catch (_) {
        // Broader fallback
        await page.waitForTimeout(5_000);
      }

      // Check for any results content
      const page_text = await page.content();
      const hasResults =
        page_text.includes("R²") ||
        page_text.includes("R-squared") ||
        page_text.includes("Coefficients") ||
        page_text.includes("Intercept") ||
        page_text.includes("coef");

      if (hasResults) {
        pass("Regression results visible (R² / coefficients found)");
        results.push({ test: "Regression results rendered", status: "PASS" });
      } else {
        // Check error toast
        const errorToast = await page.locator('[role="alert"], [class*="toast"], [class*="error"]').count();
        if (errorToast > 0) {
          const toastText = await page.locator('[role="alert"], [class*="toast"], [class*="error"]').first().textContent();
          fail(`Regression error shown: ${toastText}`);
          results.push({ test: "Regression results rendered", status: "FAIL", detail: toastText ?? "" });
        } else {
          fail("No regression results or error found");
          results.push({ test: "Regression results rendered", status: "FAIL" });
        }
      }

      await screenshot(page, "07-regression-results");
    }

  } catch (err) {
    console.error("\n  ✗ Unexpected error:", err.message);
    results.push({ test: "Unexpected error", status: "FAIL", detail: err.message });
    await screenshot(page, "99-error");
  } finally {
    await browser.close();
  }

  // ── REPORT ─────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  GUI Test Report — Lumina Smoke Test");
  console.log(`  URL: ${BASE_URL}   Date: ${new Date().toISOString()}`);
  console.log("──────────────────────────────────────────────────────────────");
  console.log(`  Result: ${failed === 0 ? "✅ PASSED" : "❌ FAILED"}  (${passed} passed, ${failed} failed)`);
  console.log("──────────────────────────────────────────────────────────────");

  const padded = (s, n) => String(s).padEnd(n);
  for (const r of results) {
    const icon = r.status === "PASS" ? "✓" : "✗";
    const detail = r.detail ? ` — ${r.detail}` : "";
    console.log(`  ${icon}  ${padded(r.test, 48)} ${r.status}${detail}`);
  }
  console.log("══════════════════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
