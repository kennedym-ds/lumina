import { chromium } from "playwright";

const BASE_URL = "http://localhost:1420";
const SCREENSHOT_DIR = "e2e/screenshots";
const VIEWPORT = { width: 1440, height: 900 };
const DEFAULT_TIMEOUT = 20_000;

const captures = [];
const issues = [];

function screenshotPath(filename) {
  return `${SCREENSHOT_DIR}/${filename}`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function recordIssue(feature, detail) {
  issues.push({ feature, detail });
  console.warn(`⚠ ${feature}: ${detail}`);
}

async function capture(page, filename, description) {
  const path = screenshotPath(filename);
  await page.screenshot({ path, fullPage: false, animations: "disabled" });
  captures.push({ filename, description, path });
  console.log(`📷 ${filename} — ${description}`);
}

async function waitForIdle(page, timeout = DEFAULT_TIMEOUT) {
  await page.waitForLoadState("networkidle", { timeout }).catch(() => undefined);
}

function chartPanels(page) {
  return page.locator("article").filter({
    has: page.getByRole("button", { name: "Remove chart" }),
  });
}

function chartPanel(page, index = 0) {
  return chartPanels(page).nth(index);
}

async function manualDrag(page, source, target) {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error("Could not resolve drag bounding boxes.");
  }

  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  const steps = 16;
  for (let index = 1; index <= steps; index += 1) {
    const x = startX + ((endX - startX) * index) / steps;
    const y = startY + ((endY - startY) * index) / steps;
    await page.mouse.move(x, y);
  }

  await page.mouse.up();
}

async function getShelfDropZone(panel, shelfLabel) {
  const label = panel.locator("p").filter({
    hasText: new RegExp(`^${escapeRegex(shelfLabel)}$`),
  }).first();

  await label.waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
  return label.locator("xpath=following-sibling::div[1]");
}

async function shelfContains(dropZone, variableName) {
  const text = (await dropZone.textContent()) ?? "";
  return text.includes(variableName);
}

async function assignShelf(page, panel, variableName, shelfLabel) {
  const source = page.locator("aside.rounded-lg button").filter({
    hasText: variableName,
  }).first();

  const dropZone = await getShelfDropZone(panel, shelfLabel);
  await source.scrollIntoViewIfNeeded();
  await dropZone.scrollIntoViewIfNeeded();

  if (await shelfContains(dropZone, variableName)) {
    return;
  }

  let assigned = false;

  for (const attempt of ["dragTo", "replace-and-drag", "manual"]) {
    try {
      if (attempt === "dragTo") {
        await source.dragTo(dropZone);
      } else if (attempt === "replace-and-drag") {
        const removeButton = dropZone.getByRole("button", { name: /Remove /i });
        if ((await removeButton.count()) > 0) {
          await removeButton.first().click();
        }
        await source.dragTo(dropZone);
      } else {
        await manualDrag(page, source, dropZone);
      }
    } catch {
      // Try the next fallback.
    }

    await page.waitForTimeout(500);
    if (await shelfContains(dropZone, variableName)) {
      assigned = true;
      break;
    }
  }

  if (!assigned) {
    throw new Error(`Failed to assign ${variableName} to ${shelfLabel}.`);
  }
}

async function waitForPlot(panel, timeout = DEFAULT_TIMEOUT) {
  const plot = panel.locator(".js-plotly-plot").first();
  await plot.waitFor({ state: "visible", timeout });
  await panel.page().waitForTimeout(1_200);
}

async function setChartType(panel, label) {
  const button = panel.getByRole("button", { name: label, exact: true });
  await button.click();
  await button.waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
  await panel.page().waitForTimeout(250);
}

async function openTab(page, label) {
  await page.getByRole("button", { name: new RegExp(label, "i") }).click();
  await page.waitForTimeout(400);
}

async function selectOptionByText(selectLocator, matcher) {
  const options = await selectLocator.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: node.getAttribute("value") ?? "",
      text: node.textContent?.trim() ?? "",
    })),
  );

  const match = options.find((option) => matcher(option.text));
  if (!match || !match.value) {
    throw new Error("Unable to find select option matching requested text.");
  }

  await selectLocator.selectOption(match.value);
}

async function selectFirstMatchingOption(selectLocator, preferredTexts) {
  const options = await selectLocator.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: node.getAttribute("value") ?? "",
      text: node.textContent?.trim() ?? "",
    })),
  );

  for (const preferredText of preferredTexts) {
    const match = options.find((option) => option.text.toLowerCase().includes(preferredText.toLowerCase()));
    if (match?.value) {
      await selectLocator.selectOption(match.value);
      return match.text;
    }
  }

  const fallback = options.find((option) => option.value && option.text.toLowerCase() !== "none");
  if (!fallback?.value) {
    return null;
  }

  await selectLocator.selectOption(fallback.value);
  return fallback.text;
}

async function addDashboardPanel(page, chartLabelSnippet) {
  const select = page.getByLabel("Dashboard chart selection");
  await selectOptionByText(select, (text) => text.toLowerCase().includes(chartLabelSnippet.toLowerCase()));
  await page.getByRole("button", { name: /^Add Chart$/ }).click();
  await page.waitForTimeout(600);
}

async function fitModel(page) {
  await page.getByRole("button", { name: "Fit Model" }).click();

  const missingDialog = page.getByRole("dialog").filter({ hasText: "Missing values detected" });
  if (await missingDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await missingDialog.getByRole("button", { name: "Use Mean Imputation" }).click();
  }

  await page.getByText("Model Summary").waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
  await page.waitForTimeout(1_000);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT });
const page = await context.newPage();

try {
  page.setDefaultTimeout(DEFAULT_TIMEOUT);

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Import a dataset to get started" }).waitFor({ state: "visible" });
  await capture(page, "showcase-01-landing.png", "Landing page with sample dataset cards");

  const penguinCard = page.locator("article").filter({ hasText: "Palmer Penguins" }).first();
  await penguinCard.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Data" }).waitFor({ state: "visible" });
  await page.locator("[data-testid='data-table-virtual-container']").waitFor({ state: "visible" });
  await waitForIdle(page);
  await page.waitForTimeout(1_000);
  await capture(page, "showcase-02-data-table.png", "Data table with dataset loaded and sidebar visible");

  const hideSidebar = page.getByRole("button", { name: "Hide Sidebar" });
  if (await hideSidebar.isVisible().catch(() => false)) {
    await hideSidebar.click();
    await page.getByRole("button", { name: "Show Sidebar" }).waitFor({ state: "visible" });
  }

  await openTab(page, "Charts");
  const mainPanel = chartPanel(page, 0);
  await mainPanel.waitFor({ state: "visible" });
  await page.locator("aside.rounded-lg h2").filter({ hasText: "Variables" }).first().waitFor({ state: "visible" });

  await setChartType(mainPanel, "Scatter");
  await assignShelf(page, mainPanel, "bill_length_mm", "X Axis");
  await assignShelf(page, mainPanel, "bill_depth_mm", "Y Axis");
  try {
    await assignShelf(page, mainPanel, "species", "Color");
  } catch (error) {
    recordIssue("Scatter color grouping", error.message);
  }
  await waitForPlot(mainPanel);
  await capture(page, "showcase-03-scatter-chart.png", "Scatter plot of bill length vs bill depth grouped by species");

  await setChartType(mainPanel, "Histogram");
  await assignShelf(page, mainPanel, "body_mass_g", "X Axis");
  try {
    await assignShelf(page, mainPanel, "species", "Color");
  } catch (error) {
    recordIssue("Histogram color grouping", error.message);
  }
  await waitForPlot(mainPanel);
  await capture(page, "showcase-04-histogram.png", "Histogram of body mass");

  await setChartType(mainPanel, "Box");
  await assignShelf(page, mainPanel, "flipper_length_mm", "Y Axis");
  try {
    await assignShelf(page, mainPanel, "species", "Color");
  } catch (error) {
    recordIssue("Box plot grouping", error.message);
  }
  await waitForPlot(mainPanel);
  await capture(page, "showcase-05-box-plot.png", "Box plot comparing flipper length across species groups");

  await setChartType(mainPanel, "Violin");
  await assignShelf(page, mainPanel, "species", "X Axis");
  await assignShelf(page, mainPanel, "flipper_length_mm", "Y Axis");
  try {
    await assignShelf(page, mainPanel, "species", "Color");
  } catch (error) {
    recordIssue("Violin plot grouping", error.message);
  }
  await waitForPlot(mainPanel);
  await capture(page, "showcase-06-violin-plot.png", "Violin plot of flipper length by species");

  await setChartType(mainPanel, "Heatmap");
  await assignShelf(page, mainPanel, "bill_length_mm", "X Axis");
  await assignShelf(page, mainPanel, "bill_depth_mm", "Y Axis");
  await waitForPlot(mainPanel);
  await capture(page, "showcase-07-heatmap.png", "Heatmap of bill length vs bill depth");

  const addChartButton = page.getByRole("button", { name: /^Add Chart$/ }).last();

  await addChartButton.click();
  const scatterPanel = chartPanel(page, 1);
  await scatterPanel.waitFor({ state: "visible" });
  await setChartType(scatterPanel, "Scatter");
  await assignShelf(page, scatterPanel, "bill_length_mm", "X Axis");
  await assignShelf(page, scatterPanel, "bill_depth_mm", "Y Axis");
  await assignShelf(page, scatterPanel, "species", "Color");
  await waitForPlot(scatterPanel);

  await addChartButton.click();
  const histogramPanel = chartPanel(page, 2);
  await histogramPanel.waitFor({ state: "visible" });
  await setChartType(histogramPanel, "Histogram");
  await assignShelf(page, histogramPanel, "body_mass_g", "X Axis");
  await assignShelf(page, histogramPanel, "species", "Color");
  await waitForPlot(histogramPanel);

  await openTab(page, "Profile");
  await page.getByText("Correlation Matrix").waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
  await page.locator("section").filter({ hasText: "Correlation Matrix" }).locator(".js-plotly-plot").waitFor({ state: "visible" });
  await capture(page, "showcase-08-profiling.png", "Profiling view with summary cards and column statistics");

  const correlationHeading = page.getByText("Correlation Matrix").first();
  await correlationHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await capture(page, "showcase-09-correlation.png", "Correlation matrix heatmap");

  await openTab(page, "Distribution");
  const numericSelect = page.getByLabel("Numeric column");
  const groupSelect = page.getByLabel("Group by column");
  await numericSelect.selectOption("body_mass_g");
  const selectedGroup = await selectFirstMatchingOption(groupSelect, ["species", "sex", "island"]);
  if (!selectedGroup) {
    recordIssue("Distribution grouping", "No categorical grouping column was available; captured ungrouped KDE view.");
  }
  await page.locator(".js-plotly-plot").first().waitFor({ state: "visible" });
  await page.waitForTimeout(1_000);
  await capture(page, "showcase-10-distribution.png", "Distribution comparison with KDE overlay");

  await openTab(page, "Inference");
  await page.getByLabel("T-test type").selectOption("independent");
  await page.getByLabel("Value column").selectOption("body_mass_g");
  await page.getByLabel("Grouping column").selectOption("species");
  await page.getByLabel("Group A label").fill("Adelie");
  await page.getByLabel("Group B label").fill("Gentoo");
  await page.getByRole("button", { name: "Run Test" }).click();
  await page.getByText("Inference results").waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
  await page.waitForTimeout(1_000);
  await capture(page, "showcase-11-inference.png", "T-test inference results with effect size and confidence interval");

  await openTab(page, "Regression");
  await page.locator("#dependent-variable").selectOption("body_mass_g");

  const checkboxNames = ["bill_length_mm", "flipper_length_mm"];
  for (const checkboxName of checkboxNames) {
    const label = page.locator("label").filter({ hasText: new RegExp(`^${escapeRegex(checkboxName)}$`) }).first();
    const checkbox = label.locator("input[type='checkbox']");
    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }
  }

  await fitModel(page);
  await capture(page, "showcase-12-regression-ols.png", "OLS regression model summary and coefficients");

  await page.getByRole("button", { name: "Random Forest" }).click();
  await fitModel(page);
  await page.getByText("Feature Importances").waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
  await capture(page, "showcase-13-regression-tree.png", "Random forest model summary with feature importances");

  await openTab(page, "Dashboard");
  await addDashboardPanel(page, "heatmap");
  await addDashboardPanel(page, "scatter");
  await addDashboardPanel(page, "histogram");
  await page.locator("[data-testid='dashboard-panel']").nth(2).waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
  await page.waitForTimeout(1_500);
  await capture(page, "showcase-14-dashboard.png", "Dashboard builder with multiple linked chart panels");

  console.log(JSON.stringify({ captures, issues }, null, 2));
} catch (error) {
  recordIssue("Automation run", error instanceof Error ? error.message : String(error));
  await capture(page, "showcase-error.png", "Error state captured during showcase automation");
  console.log(JSON.stringify({ captures, issues }, null, 2));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
