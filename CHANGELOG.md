# CHANGELOG

All notable changes to Lumina are documented here.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

#### Analysis Platforms
- **Statistical Process Control (Quality)** — I-MR and X̄-R/X̄-S control charts with Nelson run-rule detection, plus process-capability analysis (Cp/Cpk/Pp/Ppk, out-of-spec PPM, capability histogram).
- **Multivariate** — Principal Component Analysis (scree plot, scores, loadings) and K-Means clustering with downsampling for large datasets.
- **Design of Experiments (DOE)** — Full-factorial, fractional-factorial (with computed resolution), and Plackett–Burman design generation, with center points and CSV export.
- **Curve Fitting** — Nonlinear least-squares fitting (exponential, logistic 4PL, Michaelis–Menten, and more) via SciPy, with R²/RMSE and confidence bands.
- **Prediction Profiler** — JMP-style interactive profiler that recomputes predictions live as factor sliders move.

#### Visualization
- Five new chart types: bubble, strip, error bar, treemap, and parallel coordinates (16 total).

#### Reporting & Export
- Printable HTML report export alongside the existing Markdown report.

### Changed
- Auth token is passed to the backend sidecar via an environment variable instead of a CLI argument on Windows.

### Security
- CSV/Excel exports neutralize spreadsheet formula-injection triggers (CWE-1236), including categorical columns.

### Fixed
- SPC process capability now estimates within-subgroup sigma with the correct method (subgroup range/`d2` or std/`c4`), matching the control chart instead of always using the individuals moving-range estimate.
- DOE fractional-factorial resolution is computed over the full defining relation, accounting for generator-product cancellations.
- DOE CSV download and categorical exports are escaped against formula injection.
- Resolved all backend `mypy` type errors so the `lint-backend` CI job passes.

---

## [2.0.0] — 2026-03-11

### Added

#### Data
- Parquet and SQLite file import support.
- Computed columns: arithmetic, log, and z-score transforms on existing columns.
- Composable row-filter builder with numeric ranges and categorical selections.

#### Visualization
- Six new chart types: violin, density, pie, area, line, and QQ plot (11 total).
- Faceting support — split any chart by a categorical variable for small multiples.
- Dashboard builder — compose multi-panel dashboards with linked charts.

#### Statistical Analysis
- One-click dataset profiling: per-column histograms, skewness, kurtosis, memory usage, top values.
- Correlation matrix with Pearson, Spearman, and Kendall methods.
- Distribution overlays with group-split KDE curves.

#### Inference
- Hypothesis testing: independent/paired/one-sample t-tests, chi-square, ANOVA.
- Confidence intervals and effect sizes: Cohen's d, eta-squared, Cramér's V.
- Bayesian inference: conjugate-prior one-sample and two-sample tests with Bayes factors.

#### Modeling
- Regularized regression: Ridge, Lasso, and Elastic Net with configurable alpha.
- Tree-based models: Decision Tree and Random Forest with feature importances.
- Model comparison history: side-by-side R², RMSE, MAE across all fitted models.
- Polynomial features support for all linear model types.

#### Reporting & Export
- Markdown summary report generation with dataset overview and model results.
- CSV and Excel dataset export.
- Export menu in toolbar for quick access.

#### Platform
- Plugin architecture: register custom chart types, transforms, and statistical tests.
- Cross-platform build scripts (Windows, macOS, Linux).
- GitHub Actions CI workflow for automated installer builds on tag push.
- Build documentation at `docs/BUILDING.md`.
- Showcase screenshot capture script at `e2e/lumina-showcase.mjs`.

### Changed
- README expanded with full feature inventory and 14 showcase screenshots.
- `package.json` updated with cross-platform build scripts.
- `tauri.conf.json` bundle resources updated for cross-platform sidecar paths.
- PyInstaller spec (`lumina-backend.spec`) updated with scipy hidden imports.

---

## [1.0.0] — 2026-03-10

### Added

#### Data Ingestion
- Import CSV and XLSX files via drag-and-drop or file picker dialog.
- Apache Arrow columnar storage for efficient in-memory access on datasets exceeding 100,000 rows.
- Automatic column type detection (numeric, categorical, datetime) on upload.
- Summary statistics (mean, median, std, min, max, null count) computed per column at import time.
- Bundled sample datasets: Palmer Penguins, Iris, and Titanic.

#### Data Table
- Virtual scrolling data grid — renders only visible rows; handles 100K+ rows without degradation.
- Sortable columns with ascending/descending toggle.
- Column type badges and null-value indicators.

#### Chart Builder
- Drag-and-drop variable shelves for X axis, Y axis, Color, and Facet.
- Five chart types: scatter, bar, histogram, box plot, and heatmap.
- WebGL rendering path for scatter plots with more than 10,000 points.
- Up to 8 simultaneous charts in a resizable panel layout.
- Export individual charts as PNG or SVG.

#### Cross-Filtering
- Click a data point or bar segment in any chart to create a selection.
- All charts linked to the same dataset update simultaneously to reflect the filtered subset.
- Clear selection button removes the filter from all linked charts.

#### Regression Platform
- Ordinary Least Squares (OLS) regression via statsmodels — summary table with coefficients, standard errors, t-statistics, p-values, and R².
- Logistic regression via scikit-learn — coefficients, decision boundary, and model accuracy.
- Diagnostic plots: residuals vs fitted, Q-Q plot, scale-location, and leverage plot (OLS).
- Confusion matrix and ROC curve with AUC score (logistic).

#### Project Persistence
- Save and load `.lumina` project files — preserves dataset reference, chart configurations, regression config, and saved views.
- Export all charts in a session as a ZIP archive containing PNG files.

#### UX Polish
- Undo/redo for chart configuration changes (up to 50 steps).
- Favourite views: name and save a chart configuration for quick recall.
- Resizable sidebar and chart panel with drag handles.
- Colorblind-safe default palette (Okabe-Ito) applied to all chart color encodings.

### Security

- Per-session bearer token: 48-character alphanumeric token generated by the Tauri shell at startup, injected into the WebView, and required on every API request.
- Localhost-only binding: the FastAPI backend binds exclusively to `127.0.0.1`. No external network interface is exposed.
- CORS allowlist restricted to Tauri WebView origins (`http://localhost:1420`, `tauri://localhost`, `https://tauri.localhost`).
- Bearer token is ephemeral — generated fresh on every app launch, never written to disk or logged.
- OpenAPI documentation (`/api/docs`) suppressed in production builds.

---

[Unreleased]: https://github.com/kennedym-ds/lumina/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/kennedym-ds/lumina/releases/tag/v2.0.0
[1.0.0]: https://github.com/kennedym-ds/lumina/releases/tag/v1.0.0
