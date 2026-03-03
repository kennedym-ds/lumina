# Lumina — Project Specification

| Field          | Value                                                  |
|----------------|--------------------------------------------------------|
| **Status**     | DRAFT                                                  |
| **Version**    | 0.1.0                                                  |
| **Author**     | Spec Agent                                             |
| **Created**    | 2026-03-03                                             |
| **License**    | MIT                                                    |
| **Complexity** | COMPREHENSIVE                                          |

---

## 1. Overview

Lumina is an open-source, desktop data visualization and statistical modeling platform for Windows. It targets analysts, researchers, and students who need interactive exploratory data analysis (EDA) and regression modeling **without** writing code or managing Python environments.

The application ships as a single-click Windows installer powered by Tauri v2 (native shell) with a React frontend and a FastAPI backend bundled as a PyInstaller sidecar executable.

---

## 2. Goals

| ID       | Goal                                                                                             |
|----------|--------------------------------------------------------------------------------------------------|
| GOAL-01  | Deliver a zero-configuration Windows installer that requires no Python, Node.js, or admin rights |
| GOAL-02  | Provide interactive, cross-filtered data visualization across multiple chart types               |
| GOAL-03  | Support descriptive statistics / EDA and linear / logistic regression out of the box             |
| GOAL-04  | Establish a modular "platform" architecture so new analytical capabilities can be contributed     |
| GOAL-05  | Handle datasets up to ~1M rows with responsive UI performance                                   |
| GOAL-06  | Persist user work as `.lumina` project files that can be reopened across sessions                 |

## 3. Non-Goals

| ID       | Non-Goal                                                                          |
|----------|-----------------------------------------------------------------------------------|
| NG-01    | macOS or Linux support (future consideration only)                                |
| NG-02    | Cloud sync, multi-user collaboration, or remote data source connectors            |
| NG-03    | A code editor or scripting interface for end-users                                |
| NG-04    | Real-time streaming / live data ingestion                                         |
| NG-05    | Deep learning frameworks (TensorFlow, PyTorch)                                   |
| NG-06    | Database connectivity (SQL, NoSQL) — file-based imports (CSV, Excel, Parquet) are the sole input sources |

---

## 4. Target Users

| Persona          | Description                                                              | Key Need                            |
|------------------|--------------------------------------------------------------------------|--------------------------------------|
| **Data Analyst** | Business analyst using Excel, wants more powerful visualizations          | Point-and-click EDA & charting       |
| **Student**      | Statistics/data-science student needing quick model exploration           | Accessible regression tools, no setup|
| **Researcher**   | Social-science or health researcher familiar with JASP/SPSS              | Interactive cross-filtering, export  |

---

## 5. Functional Requirements

### 5.1 Data Ingestion

| ID       | Requirement                                                                                                  | Priority | Status        |
|----------|--------------------------------------------------------------------------------------------------------------|----------|---------------|
| REQ-001  | Import CSV and TSV files with automatic delimiter detection                                                  | P0       | [CONFIRMED]   |
| REQ-002  | Import Excel files (.xlsx, .xls) including multi-sheet selection                                             | P0       | [CONFIRMED]   |
| REQ-003  | Display a data preview (first 100 rows) immediately after import with column types inferred                  | P0       | [DRAFT]       |
| REQ-004  | Allow users to rename columns, set column types (numeric, categorical, datetime, text), and exclude columns  | P1       | [DRAFT]       |
| REQ-005  | Display dataset summary statistics (row count, column count, missing-value counts) in a sidebar panel        | P1       | [DRAFT]       |
| REQ-006  | Support drag-and-drop file import onto the application window                                                | P1       | [DRAFT]       |
| REQ-007  | Import Apache Parquet files (.parquet) with automatic schema detection via `pyarrow`                         | P0       | [CONFIRMED]   |

### 5.2 Data Table View

| ID       | Requirement                                                                                                  | Priority | Status        |
|----------|--------------------------------------------------------------------------------------------------------------|----------|---------------|
| REQ-010  | Render a scrollable, virtualized data table capable of displaying up to 1M rows without freezing             | P0       | [DRAFT]       |
| REQ-011  | Support sorting by any column (ascending/descending)                                                         | P0       | [DRAFT]       |
| REQ-012  | Support column-level text filtering and numeric range filtering                                              | P1       | [DRAFT]       |
| REQ-013  | Highlight rows in the data table that correspond to the current cross-filter selection                       | P0       | [DRAFT]       |

### 5.3 Visualization — EDA Platform

| ID       | Requirement                                                                                                  | Priority | Status        |
|----------|--------------------------------------------------------------------------------------------------------------|----------|---------------|
| REQ-020  | Provide a chart builder panel with drag-and-drop variable shelves for chart type, X-axis, Y-axis, color-by, and facet-by (see REQ-090) | P0 | [DRAFT] |
| REQ-021  | Support chart types: histogram, scatter, box plot, bar chart, line chart                                     | P0       | [DRAFT]       |
| REQ-022  | Use `Scattergl` (WebGL) traces for scatter plots when row count exceeds 10,000                               | P0       | [DRAFT]       |
| REQ-023  | Allow multiple charts to be open simultaneously in a tiled or tabbed layout                                  | P0       | [DRAFT]       |
| REQ-024  | Implement cross-filtering: lasso or box-select on any chart filters all other charts and the data table      | P0       | [CONFIRMED]   |
| REQ-025  | Provide a "Reset Selection" button to clear all active cross-filters                                         | P0       | [DRAFT]       |
| REQ-026  | Display Plotly's native toolbar (zoom, pan, download) on every chart                                         | P1       | [DRAFT]       |
| REQ-027  | Apply server-side downsampling (LTTB algorithm) for time-series with > 50K points                            | P1       | [DRAFT]       |

### 5.4 Modeling — Regression Platform

| ID       | Requirement                                                                                                  | Priority | Status        |
|----------|--------------------------------------------------------------------------------------------------------------|----------|---------------|
| REQ-030  | Provide a regression configuration panel: select dependent variable, independent variables, model type        | P0       | [DRAFT]       |
| REQ-031  | Support Ordinary Least Squares (OLS) linear regression                                                       | P0       | [CONFIRMED]   |
| REQ-032  | Support logistic regression (binary classification)                                                          | P0       | [CONFIRMED]   |
| REQ-033  | Display model summary: coefficients, standard errors, p-values, R², AIC/BIC                                  | P0       | [DRAFT]       |
| REQ-034  | Render residual diagnostic plots (residuals vs. fitted, Q-Q plot)                                            | P1       | [DRAFT]       |
| REQ-035  | Render a confusion matrix and ROC curve for logistic regression models                                       | P1       | [DRAFT]       |
| REQ-036  | Allow train/test split configuration (default 80/20) with a random seed input                                | P1       | [DRAFT]       |
| REQ-037  | Handle missing values gracefully: warn user, offer listwise deletion or mean imputation                      | P1       | [DRAFT]       |

### 5.5 Export

| ID       | Requirement                                                                                                  | Priority | Status        |
|----------|--------------------------------------------------------------------------------------------------------------|----------|---------------|
| REQ-040  | Export any chart as PNG (default) or SVG via Plotly's built-in export                                        | P0       | [CONFIRMED]   |
| REQ-041  | Allow user to set export resolution (1x, 2x, 3x) for PNG exports                                            | P2       | [DRAFT]       |

### 5.6 Project Persistence

| ID       | Requirement                                                                                                  | Priority | Status        |
|----------|--------------------------------------------------------------------------------------------------------------|----------|---------------|
| REQ-050  | Save current session as a `.lumina` project file (JSON-based) containing dataset path, column config, charts, and model settings | P0 | [CONFIRMED] |
| REQ-051  | Open a `.lumina` file and restore the full workspace state (reload data, rebuild charts, rerun models)       | P0       | [DRAFT]       |
| REQ-052  | Prompt "Save changes?" on close if unsaved modifications exist                                               | P1       | [DRAFT]       |
| REQ-053  | Show a "Recent Projects" list on the start screen                                                            | P2       | [DRAFT]       |

### 5.7 Platform Extensibility

| ID       | Requirement                                                                                                  | Priority | Status        |
|----------|--------------------------------------------------------------------------------------------------------------|----------|---------------|
| REQ-060  | Define a `Platform` interface contract: a React component (UI) paired with a FastAPI router (compute)        | P0       | [DRAFT]       |
| REQ-061  | Platforms are discovered via a registry file and lazy-loaded into the sidebar navigation                     | P1       | [DRAFT]       |
| REQ-062  | Provide a contributor guide documenting how to scaffold a new platform                                       | P2       | [DRAFT]       |

### 5.8 Onboarding & Empty States

| ID       | Requirement                                                                                                  | Priority | Status        |
|----------|--------------------------------------------------------------------------------------------------------------|----------|---------------|
| REQ-080  | Display an empty-state drop-zone on the start screen with a dashed border, file-import prompt, and list of built-in sample datasets | P1 | [CONFIRMED] |
| REQ-081  | Bundle 3 sample datasets (Palmer Penguins, Titanic, Iris) inside the application for immediate use           | P1       | [CONFIRMED]   |
| REQ-082  | Clicking a sample dataset loads it directly without a file picker dialog                                     | P1       | [DRAFT]       |
| REQ-083  | Display contextual empty states within the chart area ("Drag variables to the shelves to create a chart") and the data table ("Import a dataset to begin") | P1 | [CONFIRMED] |

### 5.9 Variable Shelves & Type Icons

| ID       | Requirement                                                                                                  | Priority | Status        |
|----------|--------------------------------------------------------------------------------------------------------------|----------|---------------|
| REQ-090  | Provide drag-and-drop variable shelves (X-axis, Y-axis, Color, Facet) in the chart builder where users drop columns from a variable list | P0 | [CONFIRMED] |
| REQ-091  | Display a type icon next to each variable name in the sidebar: 📏 continuous, 🏷️ categorical, 📅 datetime, 📝 text | P1 | [CONFIRMED] |
| REQ-092  | Allow users to change a column's type by clicking the type icon (opens a type-selector popover)              | P1       | [CONFIRMED]   |
| REQ-093  | Show a chip with the variable name and a ✕ remove button inside each shelf; pressing Delete key also removes | P1       | [DRAFT]       |
| REQ-094  | Auto-render the chart when all required shelves (at minimum X-axis) are populated                            | P1       | [DRAFT]       |

### 5.10 Resizable Layout

| ID       | Requirement                                                                                                  | Priority | Status        |
|----------|--------------------------------------------------------------------------------------------------------------|----------|---------------|
| REQ-100  | Split the main workspace into resizable panels: sidebar, variable list / chart area, and data table          | P1       | [CONFIRMED]   |
| REQ-101  | Panel boundaries are draggable via splitter handles; panel sizes persist within the session                   | P1       | [DRAFT]       |
| REQ-102  | Each panel (sidebar, data table) is individually collapsible via a toggle or double-click on the splitter     | P1       | [CONFIRMED]   |
| REQ-103  | Collapsing the data table expands the chart area to fill the available space                                  | P1       | [DRAFT]       |

### 5.11 Undo / Redo & Clipboard

| ID       | Requirement                                                                                                  | Priority | Status        |
|----------|--------------------------------------------------------------------------------------------------------------|----------|---------------|
| REQ-110  | Support Ctrl+Z (undo) and Ctrl+Y (redo) for chart configuration changes (add/remove chart, change axis, change chart type) | P1 | [CONFIRMED] |
| REQ-111  | Maintain an action history stack (minimum 50 entries) in the frontend state                                  | P1       | [DRAFT]       |
| REQ-112  | Display undo/redo buttons in the toolbar with tooltip showing the action to be undone/redone                 | P1       | [DRAFT]       |
| REQ-113  | Copy the currently focused chart to the system clipboard as a PNG image via Ctrl+C or right-click → "Copy Chart" | P1 | [CONFIRMED] |
| REQ-114  | Undo scope is limited to workspace configuration (chart/variable assignments); data mutations (column type changes) are not undoable | P1 | [DRAFT] |

### 5.12 Favourite Views

| ID       | Requirement                                                                                                  | Priority | Status        |
|----------|--------------------------------------------------------------------------------------------------------------|----------|---------------|
| REQ-070  | Allow users to save the current workspace arrangement (open charts, chart configs, cross-filter state) as a named "favourite view" | P1 | [CONFIRMED] |
| REQ-071  | Display a list of saved favourite views in a sidebar panel or dropdown accessible from the toolbar            | P1       | [DRAFT]       |
| REQ-072  | Restore a favourite view with one click, rebuilding all charts and reapplying the saved cross-filter state    | P1       | [DRAFT]       |
| REQ-073  | Allow users to rename and delete saved favourite views                                                        | P1       | [DRAFT]       |
| REQ-074  | Persist favourite views inside the `.lumina` project file so they survive across sessions                     | P1       | [DRAFT]       |
| REQ-075  | Display a visual indicator when the current workspace matches a saved favourite view                          | P2       | [DRAFT]       |

---

### 5.13 Accessibility & Theming

| ID       | Requirement                                                                                                  | Priority | Status        |
|----------|--------------------------------------------------------------------------------------------------------------|----------|---------------|
| REQ-120  | Use a colorblind-safe categorical palette (Okabe-Ito) as the default for all chart color sequences           | P1       | [CONFIRMED]   |
| REQ-121  | Provide a palette selector in Settings allowing users to choose from 3-4 accessible palettes                 | P2       | [DRAFT]       |
| REQ-122  | Translate backend analytical errors (singular matrix, convergence failure, etc.) into plain-language toast notifications with actionable suggestions | P1 | [CONFIRMED] |
| REQ-123  | Display errors as dismissible toast notifications anchored to the bottom of the workspace                    | P1       | [DRAFT]       |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID       | Requirement                                                                              | Target               |
|----------|------------------------------------------------------------------------------------------|----------------------|
| NFR-001  | Application cold start (installer → usable UI) time                                     | ≤ 8 seconds          |
| NFR-002  | CSV import (100K rows, 20 columns) processing time                                      | ≤ 3 seconds          |
| NFR-003  | Chart render time for scatter plot with 100K points (WebGL)                              | ≤ 1 second           |
| NFR-004  | Cross-filter propagation latency across 4 open charts                                   | ≤ 300 ms             |
| NFR-005  | OLS regression fit time on dataset with 500K rows × 10 features                         | ≤ 5 seconds          |
| NFR-006  | Backend API response time for data endpoints (p95)                                      | ≤ 500 ms             |
| NFR-007  | Application idle memory footprint (no dataset loaded)                                   | ≤ 200 MB RAM         |
| NFR-008  | Undo/redo action execution latency                                                       | ≤ 100 ms             |

### 6.2 Reliability

| ID       | Requirement                                                                              |
|----------|------------------------------------------------------------------------------------------|
| NFR-010  | If the backend sidecar crashes, display an error dialog and offer "Restart Backend"      |
| NFR-011  | Graceful error handling for malformed CSV/Excel/Parquet files with user-facing messages   |
| NFR-012  | All backend endpoints return structured error responses (JSON `{error, detail, code}`)   |
| NFR-013  | Backend analytical errors include a `user_message` field with plain-language explanation  |

### 6.3 Security

| ID       | Requirement                                                                              |
|----------|------------------------------------------------------------------------------------------|
| NFR-020  | Backend listens only on `127.0.0.1` (localhost), never on `0.0.0.0`                     |
| NFR-021  | Use a dynamically assigned port with a shared secret token passed from Tauri to sidecar  |
| NFR-022  | No user data is transmitted outside the local machine                                    |

### 6.4 Packaging & Distribution

| ID       | Requirement                                                                              |
|----------|------------------------------------------------------------------------------------------|
| NFR-030  | Installer size ≤ 350 MB (compressed)                                                    |
| NFR-031  | Target: Windows 10 (build 1809+) and Windows 11                                         |
| NFR-032  | Single `.msi` or `.exe` installer generated by Tauri's bundler                           |
| NFR-033  | No runtime prerequisite besides WebView2 (pre-installed on Windows 10 1809+)             |

### 6.5 Accessibility

| ID       | Requirement                                                                              |
|----------|------------------------------------------------------------------------------------------||
| NFR-040  | Default color palette passes WCAG 2.1 AA contrast ratio (≥ 4.5:1) against chart background |
| NFR-041  | All interactive UI elements are reachable via keyboard (Tab, Enter, Escape, Arrow keys)   |
| NFR-042  | Error messages are role="alert" for screen reader announcement                            |

---

## 7. System Architecture

### 7.1 High-Level Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    Tauri v2 Shell                         │
│  ┌────────────────────────┐  ┌─────────────────────────┐ │
│  │    React Frontend       │  │   FastAPI Sidecar       │ │
│  │                         │  │   (PyInstaller .exe)    │ │
│  │  ┌───────────────────┐  │  │                         │ │
│  │  │ Chart Builder      │  │  │  ┌──────────────────┐  │ │
│  │  │ (react-plotly.js)  │──┼──┼─▶│ /api/data/*      │  │ │
│  │  └───────────────────┘  │  │  │ /api/eda/*        │  │ │
│  │  ┌───────────────────┐  │  │  │ /api/model/*      │  │ │
│  │  │ Data Table         │  │  │  │ /api/export/*     │  │ │
│  │  │ (virtualized)      │  │  │  └──────────────────┘  │ │
│  │  └───────────────────┘  │  │                         │ │
│  │  ┌───────────────────┐  │  │  ┌──────────────────┐  │ │
│  │  │ Cross-Filter Store │  │  │  │ pandas / sklearn │  │ │
│  │  │ (Zustand)          │  │  │  │ statsmodels      │  │ │
│  │  └───────────────────┘  │  │  │ scipy             │  │ │
│  └────────────────────────┘  │  └──────────────────────┘ │ │
│                              └─────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Component Breakdown

#### 7.2.1 Tauri Shell (Rust)

- **Responsibility**: Native window management, sidecar lifecycle, file-system dialogs, `.lumina` file association.
- **Sidecar Management**: Spawns the PyInstaller backend executable on `setup()`, passing a dynamically assigned port and auth token via command-line arguments. Kills the process on `on_exit()`.
- **Configuration**: `tauri.conf.json` registers the sidecar under `plugins.shell.scope` with name `lumina-backend` and `sidecar: true`. The binary is placed in `src-tauri/binaries/` named per target triple (e.g., `lumina-backend-x86_64-pc-windows-msvc.exe`).

#### 7.2.2 React Frontend

- **Framework**: React 18+ with TypeScript
- **State Management**: Zustand for global state (active dataset, cross-filter selections, chart configurations)
- **Routing**: React Router for navigation between platforms (EDA, Regression, future platforms)
- **Charting**: `react-plotly.js` with `plotly.js-dist-min` for reduced bundle size
- **Data Table**: `@tanstack/react-virtual` for virtualized row rendering
- **HTTP Client**: `@tanstack/react-query` wrapping `fetch()` for caching and request deduplication
- **Styling**: Tailwind CSS for utility-first component styling

#### 7.2.3 FastAPI Backend

- **Framework**: FastAPI with Uvicorn (programmatic launch, not CLI)
- **Data Layer**: pandas DataFrames held in a session-scoped in-memory store keyed by dataset ID
- **Modeling**: `statsmodels` for OLS/logistic regression; `scikit-learn` for train/test splitting and evaluation metrics
- **Downsampling**: Custom LTTB implementation for time-series decimation
| **Parquet Support**: `pyarrow` for native Parquet file reads with schema inference
- **Serialization**: JSON responses for metadata; consider Apache Arrow (via `pyarrow`) for large data transfers in future iterations

#### 7.2.4 PyInstaller Packaging

- **Mode**: `--onedir` (not `--onefile`) for faster startup and reduced antivirus false positives
- **Hidden Imports**: Explicit list for `uvicorn.*`, `pydantic.*`, `sklearn.*`, `statsmodels.*`, `pyarrow.*`
- **Expected Size**: 300–500 MB uncompressed for the sidecar directory
- **Startup**: The `.exe` entry point calls `uvicorn.run("app.main:app", host="127.0.0.1", port=<dynamic>)` programmatically

### 7.3 Communication Protocol

| Aspect            | Design                                                                                |
|-------------------|---------------------------------------------------------------------------------------|
| **Transport**     | HTTP/1.1 over localhost                                                               |
| **Port**          | Dynamically assigned; Tauri finds a free port, passes it to sidecar and frontend      |
| **Auth**          | Bearer token generated per session, passed as CLI arg to sidecar, stored in React env |
| **Data Format**   | JSON (request/response bodies); `multipart/form-data` for file uploads                |
| **Error Format**  | `{ "error": "<code>", "detail": "<message>", "status": <http_code> }`                |

### 7.4 Cross-Filtering Architecture

```
User lasso-selects points on Chart A
        │
        ▼
  Plotly onSelected event fires
        │
        ▼
  Extract selected row indices
        │
        ▼
  Update Zustand cross-filter store
        │
        ▼
  All subscribed components re-render:
    ├── Chart B: applies opacity mask to non-selected points
    ├── Chart C: applies opacity mask to non-selected points
    └── Data Table: scrolls to and highlights selected rows
```

- The cross-filter store holds a `Set<number>` of selected row indices.
- Each chart component subscribes to the store and applies `marker.opacity` arrays (1.0 for selected, 0.15 for unselected).
- When the selection is cleared, all opacities reset to 1.0.
- Future optimization: integrate `crossfilter2` for client-side dimension slicing on larger datasets.

---

## 8. API Design

### 8.1 Data Endpoints

| Method | Path                        | Description                                  | Request Body                    | Response                     |
|--------|-----------------------------|----------------------------------------------|---------------------------------|------------------------------|
| POST   | `/api/data/upload`          | Upload CSV or Excel file                     | `multipart/form-data` (file)   | `{ dataset_id, columns, row_count }` |
| GET    | `/api/data/{id}/preview`    | Get first N rows for preview                 | Query: `?rows=100`             | `{ columns, data[][] }`     |
| GET    | `/api/data/{id}/summary`    | Get column-level summary statistics          | —                              | `{ columns: [{ name, dtype, missing, mean, ... }] }` |
| GET    | `/api/data/{id}/rows`       | Get paginated rows                           | Query: `?offset=0&limit=1000`  | `{ total, data[][] }`       |
| POST   | `/api/data/{id}/column-config` | Update column types and exclusions        | `{ columns: [{ name, dtype, excluded }] }` | `{ ok: true }` |

### 8.2 EDA Endpoints

| Method | Path                        | Description                                  | Request Body                    | Response                     |
|--------|-----------------------------|----------------------------------------------|---------------------------------|------------------------------|
| POST   | `/api/eda/{id}/chart`       | Generate Plotly JSON specification           | `{ chart_type, x, y, color_by, facet_by }` | Plotly JSON figure |
| POST   | `/api/eda/{id}/downsample`  | Get downsampled series via LTTB              | `{ x_col, y_col, max_points }` | `{ x[], y[] }`              |

### 8.3 Model Endpoints

| Method | Path                            | Description                              | Request Body                                  | Response                       |
|--------|---------------------------------|------------------------------------------|-----------------------------------------------|--------------------------------|
| POST   | `/api/model/{id}/regression`    | Fit OLS or logistic regression           | `{ model_type, dependent, independents, test_size, seed }` | `{ model_id, summary, coefficients[], metrics }` |
| GET    | `/api/model/{id}/diagnostics`   | Get residual and diagnostic plot data    | Query: `?model_id=<mid>`                      | Plotly JSON figures            |
| GET    | `/api/model/{id}/confusion`     | Get confusion matrix (logistic only)     | Query: `?model_id=<mid>`                      | `{ matrix[][], labels[] }`    |
| GET    | `/api/model/{id}/roc`           | Get ROC curve data (logistic only)       | Query: `?model_id=<mid>`                      | `{ fpr[], tpr[], auc }`      |

### 8.4 Project Endpoints

| Method | Path                        | Description                                  | Request Body                    | Response                     |
|--------|-----------------------------|----------------------------------------------|---------------------------------|------------------------------|
| POST   | `/api/project/save`        | Serialize session state to `.lumina` JSON    | `{ file_path, state }`         | `{ ok: true }`              |
| POST   | `/api/project/load`        | Load a `.lumina` file and restore state      | `{ file_path }`                | `{ state }`                 |

### 8.5 Favourite Views Endpoints

| Method | Path                            | Description                              | Request Body                                  | Response                       |
|--------|---------------------------------|------------------------------------------|-----------------------------------------------|--------------------------------|
| GET    | `/api/views/{dataset_id}`       | List all saved favourite views           | —                                             | `{ views: [{ id, name, created_at }] }` |
| POST   | `/api/views/{dataset_id}`       | Save current workspace as a favourite    | `{ name, charts[], cross_filter }`            | `{ view_id, name }`           |
| GET    | `/api/views/{dataset_id}/{view_id}` | Get full view configuration          | —                                             | `{ name, charts[], cross_filter }` |
| PUT    | `/api/views/{dataset_id}/{view_id}` | Rename a favourite view              | `{ name }`                                    | `{ ok: true }`                |
| DELETE | `/api/views/{dataset_id}/{view_id}` | Delete a favourite view              | —                                             | `{ ok: true }`                |

---

## 9. Data Model

### 9.1 In-Memory Session Store

```python
# Conceptual model — not final implementation
class DatasetSession:
    dataset_id: str            # UUID
    file_path: str             # Original file location
    file_format: str           # "csv" | "excel" | "parquet"
    dataframe: pd.DataFrame    # Loaded data
    column_config: dict        # User overrides (dtype, excluded, renamed)
    models: dict[str, Any]     # Fitted model objects keyed by model_id
    favourite_views: dict[str, dict]  # Saved view snapshots keyed by view_id
```

### 9.2 `.lumina` Project File Schema

```jsonc
{
  "version": "1.0",
  "dataset": {
    "file_path": "C:/Users/analyst/data/sales.csv",
    "delimiter": ",",
    "column_config": [
      { "name": "revenue", "dtype": "numeric", "excluded": false },
      { "name": "region",  "dtype": "categorical", "excluded": false }
    ]
  },
  "charts": [
    {
      "id": "chart-1",
      "type": "scatter",
      "x": "revenue",
      "y": "units_sold",
      "color_by": "region",
      "facet_by": null,
      "position": { "row": 0, "col": 0 }
    }
  ],
  "models": [
    {
      "id": "model-1",
      "type": "ols",
      "dependent": "revenue",
      "independents": ["units_sold", "ad_spend"],
      "test_size": 0.2,
      "seed": 42
    }
  ],
  "cross_filter": {
    "active": false,
    "selected_indices": []
  },
  "favourite_views": [
    {
      "id": "view-1",
      "name": "Sales by Region Overview",
      "created_at": "2026-03-03T14:30:00Z",
      "charts": [
        { "id": "chart-1", "type": "scatter", "x": "revenue", "y": "units_sold", "color_by": "region", "facet_by": null, "position": { "row": 0, "col": 0 } }
      ],
      "cross_filter": { "active": false, "selected_indices": [] }
    }
  ]
}
```

---

## 10. UI Layout & Navigation

### 10.1 Application Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Title Bar (Tauri native)              [—] [□] [✕]        │
├──────┬──────────────────────────────────────────────────────┤
│      │  Toolbar: [Import] [Save] [Export] [⟲ Undo] [⟳ Redo]│
│  S   ├──────────────────────────────────────────────────────┤
│  I   │  ┌─── Variable List ─────┐  ┌═══ Chart Area ══════┐ │
│  D   │  │  📏 revenue           │  │ ┌──────┐ ┌──────┐   │ │
│  E   │  │  📏 units_sold        │  │ │Chart │ │Chart │   │ │
│  B   │  │  🏷️ region            │  │ │  A   │ │  B   │   │ │
│  A   │  │  📅 order_date        │  │ └──────┘ └──────┘   │ │
│  R   │  │                       │  │ ┌─ Shelves ────────┐ │ │
│      │  │  (drag to shelves →)  │  │ │ X: [revenue    ✕]│ │ │
│  📊  │  │                       │  │ │ Y: [units_sold ✕]│ │ │
│  📈  │  └───────────────────────┘  │ │ Color: [region ✕]│ │ │
│  ★   │  ┄┄┄ draggable splitter ┄┄┄ │ └──────────────────┘ │ │
│  ⚙   │  ┌═══ Data Table (collapsible, virtualized) ══════┐ │
│      │  │  ░░░░░░░░ highlighted rows ░░░░░░░░░░░░░░░░░░░ │ │
│      │  └════════════════════════════════════════════════ ┘ │
├──────┴──────────────────────────────────────────────────────┤
│  Status Bar: [Dataset: sales.csv] [Rows: 245,312] [Undo 3] │
│  ┌─ Toast ──────────────────────────────────────┐          │
│  │ ⚠ Check for collinear variables (dismiss ✕)  │          │
│  └───────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘

Empty state (no dataset loaded):
┌──────────────────────────────────────────────────┐
│                                                  │
│     ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐        │
│     │                                   │        │
│     │   📂 Drag a file here to begin    │        │
│     │   or click [Import]               │        │
│     │                                   │        │
│     │   Sample datasets:                │        │
│     │   🐧 Palmer Penguins              │        │
│     │   🚢 Titanic                      │        │
│     │   🌸 Iris                         │        │
│     │                                   │        │
│     └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘        │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 10.2 Sidebar Navigation

| Icon | Label       | Platform     | Description                       |
|------|-------------|--------------|-----------------------------------|
| 📊   | EDA         | `eda`        | Chart builder + cross-filtering   |
| 📈   | Regression  | `regression` | OLS / logistic regression config  |
| ★    | Favourites  | —            | Saved workspace views             |
| ⚙    | Settings    | —            | Application preferences           |

### 10.3 Key UI Flows

**Import Flow**: Start screen (with empty-state drop-zone + sample datasets) → Click "Import", drag file, or select sample dataset → File picker (CSV, Excel, Parquet) / drop → Backend `/upload` → Data preview with type icons → Column config → Redirect to EDA platform.

**Chart Builder Flow (Drag-and-Drop)**: Variable list on left → Drag column onto X-axis shelf → Drag column onto Y-axis shelf → Optionally drag onto Color/Facet shelves → Chart auto-renders → Remove variable by clicking ✕ on shelf chip or pressing Delete.

**Save Favourite View Flow**: EDA workspace with charts → Click "★ Save View" in toolbar → Enter view name → View saved to project → Appears in Favourites sidebar panel.

**Restore Favourite View Flow**: Click a saved view in Favourites panel → Current workspace replaced with saved chart arrangement and cross-filter state.

**Chart Creation Flow**: EDA sidebar → Select chart type → Assign columns to axes → Click "Add Chart" → Backend `/eda/{id}/chart` → Plotly renders in workspace tile.

**Regression Flow**: Switch to Regression platform → Select dependent variable → Select independent variables → Choose model type → Click "Fit Model" → Backend `/model/{id}/regression` → Display summary table + diagnostic plots.

---

## 11. Technology Stack

| Layer             | Technology                  | Version  | Rationale                                     |
|-------------------|-----------------------------|----------|-----------------------------------------------|
| Native Shell      | Tauri                       | v2.x     | Lightweight, native webview, sidecar support  |
| Frontend          | React                       | 18+      | Component model, ecosystem, community         |
| Language (FE)     | TypeScript                  | 5.x      | Type safety, IDE support                      |
| State Management  | Zustand                     | 4.x      | Minimal boilerplate, excellent TS support     |
| Charting          | react-plotly.js             | latest   | Interactive, WebGL, JSON-configurable         |
| Data Table        | @tanstack/react-virtual     | 3.x      | Virtualized rendering for large datasets      |
| Styling           | Tailwind CSS                | 3.x      | Utility-first, rapid prototyping              |
| Resizable Panels  | react-resizable-panels      | 2.x      | Draggable splitter handles for panel layout   |
| Drag & Drop       | @dnd-kit/core               | 6.x      | Accessible drag-and-drop for variable shelves |
| Data Fetching     | @tanstack/react-query       | 5.x      | Caching, dedup, background refresh            |
| Backend           | FastAPI                     | 0.110+   | Async, auto-docs, Pydantic validation         |
| ASGI Server       | Uvicorn                     | 0.27+    | Performant ASGI, programmatic launch          |
| Data Processing   | pandas                      | 2.x      | De facto standard for tabular data            |
| Parquet I/O       | pyarrow                     | 15.x+    | Fast Parquet reads; potential Arrow transport  |
| Regression        | statsmodels                 | 0.14+    | Comprehensive regression summaries            |
| ML Utilities      | scikit-learn                | 1.4+     | Train/test split, metrics, preprocessing      |
| Packaging         | PyInstaller                 | 6.x      | Freeze Python app to Windows .exe             |
| Build (FE)        | Vite                        | 5.x      | Fast HMR, optimized production builds         |

---

## 12. Risks & Mitigations

| ID     | Risk                                                                 | Likelihood | Impact | Mitigation                                                                                             |
|--------|----------------------------------------------------------------------|------------|--------|--------------------------------------------------------------------------------------------------------|
| RSK-01 | PyInstaller sidecar exceeds 500 MB, making installer too large       | Medium     | Medium | Use `--onedir` mode; exclude unused sklearn estimators; profile with `pipdeptree`                      |
| RSK-02 | Antivirus false positives on PyInstaller-built `.exe`                | High       | Medium | Code-sign the sidecar binary; use `--onedir`; document AV exclusion in FAQ                             |
| RSK-03 | Sidecar cold start > 8 seconds on low-end machines                  | Medium     | High   | Show a backend loading spinner in UI; do NOT use UPX compression; pre-warm Python imports              |
| RSK-04 | Cross-filter performance degrades with 4+ charts and >500K points   | Medium     | High   | Debounce selection events (150ms); use `requestAnimationFrame` batching; opacity masks over re-renders |
| RSK-05 | Plotly SVG rendering crashes browser with >50K points               | High       | High   | Enforce `Scattergl` for large datasets (REQ-022); server-side downsampling (REQ-027)                  |
| RSK-06 | `.lumina` file references moved/deleted data files                   | Medium     | Low    | Validate file path on load; prompt user to locate missing file                                         |
| RSK-07 | Port collision when another app occupies the dynamically chosen port | Low        | Medium | Retry with up to 5 different ports; fall back to a configurable port range                             |
| RSK-08 | WebView2 missing on older Windows 10 builds                         | Low        | High   | Tauri bundler includes WebView2 bootstrapper; document in system requirements                          |

---

## 13. Dependencies & Integrations

### 13.1 External Dependencies

| Dependency        | Type      | Risk Notes                                        |
|-------------------|-----------|---------------------------------------------------|
| WebView2 Runtime  | System    | Pre-installed on Win10 1809+; Tauri bundles bootstrapper |
| plotly.js         | NPM       | Maintained by Plotly Inc.; large bundle (~3 MB)   |
| react-resizable-panels | NPM  | Lightweight; well-maintained split-pane library   |
| @dnd-kit/core     | NPM       | Accessible drag-and-drop; actively maintained     |
| pandas            | PyPI      | Stable; major API changes unlikely in 2.x         |
| statsmodels       | PyPI      | Stable; comprehensive regression API              |
| scikit-learn      | PyPI      | Stable; metrics and splitting utilities only       |
| pyarrow           | PyPI      | Stable; Parquet I/O and potential Arrow transport  |

### 13.2 Build Dependencies

| Tool          | Purpose                                 |
|---------------|------------------------------------------|
| Rust toolchain| Tauri v2 build                           |
| Node.js 20+  | Frontend build (Vite)                    |
| Python 3.11+ | Backend development and PyInstaller      |
| PyInstaller   | Backend freezing                         |
| Tauri CLI     | Application bundling and installer generation |

---

## 14. Acceptance Criteria

### 14.1 Data Ingestion

| AC ID   | Linked Req | Criterion                                                                                   |
|---------|------------|---------------------------------------------------------------------------------------------|
| AC-001  | REQ-001    | Given a well-formed CSV file, when imported, then all rows and columns appear in data table within 3s for 100K rows |
| AC-002  | REQ-002    | Given a multi-sheet Excel file, when imported, then a sheet selector dialog appears and the chosen sheet loads correctly |
| AC-003  | REQ-003    | Given any imported file, then a 100-row preview with inferred column types is displayed before full load |
| AC-004  | REQ-007    | Given a valid Parquet file, when imported, then all rows and columns load with schema-inferred types matching the Parquet metadata |

### 14.2 Visualization & Cross-Filtering

| AC ID   | Linked Req | Criterion                                                                                   |
|---------|------------|---------------------------------------------------------------------------------------------|
| AC-010  | REQ-024    | Given 2+ charts open, when user lasso-selects points on one chart, then all other charts dim unselected points within 300ms |
| AC-011  | REQ-013    | Given an active cross-filter selection, then the data table highlights exactly the selected rows |
| AC-012  | REQ-022    | Given a scatter plot with > 10K points, then the chart uses WebGL rendering (`Scattergl` trace type) |
| AC-013  | REQ-025    | Given an active selection, when "Reset Selection" is clicked, then all charts return to full-opacity rendering |

### 14.3 Modeling

| AC ID   | Linked Req | Criterion                                                                                   |
|---------|------------|---------------------------------------------------------------------------------------------|
| AC-020  | REQ-031    | Given a dataset with numeric columns, when OLS is fitted, then the summary displays R², coefficients, p-values, and standard errors matching `statsmodels` output |
| AC-021  | REQ-032    | Given a binary target column, when logistic regression is fitted, then a confusion matrix and ROC curve are displayed |
| AC-022  | REQ-036    | Given a custom train/test split (e.g., 70/30), then the model trains on 70% and evaluates on 30% of the data |

### 14.4 Persistence & Export

| AC ID   | Linked Req | Criterion                                                                                   |
|---------|------------|---------------------------------------------------------------------------------------------|
| AC-030  | REQ-050    | Given a session with data, charts, and a model, when saved as `.lumina`, then re-opening restores the identical workspace state |
| AC-031  | REQ-040    | Given any rendered chart, when "Export as PNG" is clicked, then a PNG file is saved to the user-chosen location |

### 14.5 Onboarding & Variable Shelves

| AC ID   | Linked Req | Criterion                                                                                   |
|---------|------------|---------------------------------------------------------------------------------------------|
| AC-050  | REQ-080    | Given no dataset loaded, then the workspace displays a dashed-border drop-zone with file import prompt and sample dataset links |
| AC-051  | REQ-081    | Given the home screen, when "Palmer Penguins" sample is clicked, then the dataset loads without a file picker and the EDA platform is active |
| AC-052  | REQ-090    | Given the chart builder, when a variable is dragged from the list onto the X-axis shelf, then it appears as a removable chip in the shelf |
| AC-053  | REQ-091    | Given a loaded dataset, then each variable in the sidebar shows the correct type icon (📏 for numeric, 🏷️ for categorical, 📅 for datetime) |
| AC-054  | REQ-092    | Given a variable with a numeric type icon, when the icon is clicked and "Categorical" is selected, then the column is recast and all charts update |
| AC-055  | REQ-094    | Given the X-axis shelf is populated (scatter type selected), when the Y-axis shelf is also populated, then the chart auto-renders without clicking "Add Chart" |

### 14.6 Layout, Undo/Redo & Clipboard

| AC ID   | Linked Req | Criterion                                                                                   |
|---------|------------|---------------------------------------------------------------------------------------------|
| AC-060  | REQ-100    | Given the main workspace, then dragging the splitter between chart area and data table resizes both panels |
| AC-061  | REQ-102    | Given the data table panel, when its collapse toggle is clicked, then the chart area expands to fill the full width/height |
| AC-062  | REQ-110    | Given a chart was added and then Ctrl+Z is pressed, then the chart is removed; pressing Ctrl+Y re-adds it |
| AC-063  | REQ-113    | Given a focused chart, when Ctrl+C is pressed, then a PNG image of the chart is placed on the system clipboard |

### 14.7 Accessibility & Error Handling

| AC ID   | Linked Req | Criterion                                                                                   |
|---------|------------|---------------------------------------------------------------------------------------------|
| AC-070  | REQ-120    | Given a chart with 3+ categorical groups, then the default colors are distinguishable by a user with deuteranopia (verified against Okabe-Ito palette) |
| AC-071  | REQ-122    | Given a singular matrix error from statsmodels, then the UI displays a toast: "Check for collinear variables" (not a stack trace) |
| AC-072  | REQ-123    | Given an error toast, then it is dismissible via a ✕ button and auto-dismissed after 8 seconds |

### 14.8 Favourite Views

| AC ID   | Linked Req | Criterion                                                                                   |
|---------|------------|---------------------------------------------------------------------------------------------|
| AC-032  | REQ-070    | Given an active workspace with 2+ charts open, when "Save View" is clicked and a name entered, then the view appears in the favourites list |
| AC-033  | REQ-072    | Given a saved favourite view, when clicked, then all charts are rebuilt with the exact same configurations and cross-filter state |
| AC-034  | REQ-074    | Given a project with favourite views saved, when reopened from a `.lumina` file, then all favourite views are listed and restorable |

### 14.9 Packaging

| AC ID   | Linked Req | Criterion                                                                                   |
|---------|------------|---------------------------------------------------------------------------------------------|
| AC-040  | NFR-030    | The installer file is ≤ 350 MB compressed                                                  |
| AC-041  | NFR-001    | On a machine with 8 GB RAM and SSD, the app reaches a usable state within 8 seconds of launch |
| AC-042  | NFR-020    | A port scan confirms the backend listens only on `127.0.0.1`, not `0.0.0.0`                 |

---

## 15. Open Questions

| ID    | Question                                                                                          | Owner   | Status |
|-------|---------------------------------------------------------------------------------------------------|---------|--------|
| OQ-01 | Should the data table support inline cell editing, or is it strictly read-only?                   | Product | Open   |
| OQ-02 | Should we support `.lumina` file association in Windows Explorer (double-click to open)?           | Eng     | Open   |
| OQ-03 | What is the maximum number of simultaneous charts before we enforce a limit?                      | UX/Eng  | Open   |
| OQ-04 | Should we use Apache Arrow for frontend ↔ backend data transfer in v1, or defer to a later release? | Eng   | Open   |
| OQ-05 | Do we need an auto-update mechanism (Tauri updater plugin) for v1?                                | Product | Open   |
| OQ-06 | Should categorical encoding (one-hot / label) be automatic in the regression platform, or user-configured? | Product | Open |
| OQ-07 | Should the regression platform also use drag-and-drop shelves for dependent/independent variable assignment, or keep dropdown selectors? | UX | Open |
| OQ-08 | Should undo/redo history persist in the `.lumina` project file, or reset on each session? | Product | Open |

---

## 16. Glossary

| Term             | Definition                                                                                   |
|------------------|----------------------------------------------------------------------------------------------|
| **Cross-filter** | Interactive technique where selecting data in one view filters all linked views              |
| **EDA**          | Exploratory Data Analysis — visual and statistical techniques for understanding data         |
| **LTTB**         | Largest Triangle Three Buckets — a downsampling algorithm that preserves visual shape        |
| **OLS**          | Ordinary Least Squares — standard linear regression method                                   |
| **Platform**     | A modular analytical capability in Lumina (e.g., EDA, Regression) with paired UI and API     |
| **Sidecar**      | A co-process managed by Tauri that runs alongside the main application window                |
| **Shelf**        | A labeled drop-zone in the chart builder where users place variables (e.g., X-axis, Color)   |
| **Okabe-Ito**    | An 8-color categorical palette designed for colorblind accessibility                         |
| **WebGL**        | GPU-accelerated browser rendering API used by Plotly for large-dataset charts                 |

---

## Appendix A: Comparable Tools

| Tool           | Strengths                          | Gaps Lumina Addresses                          |
|----------------|------------------------------------|------------------------------------------------|
| Orange         | Visual programming, rich widgets   | Dated PyQt UI; no cross-filtering              |
| JASP           | Beautiful UX, Bayesian statistics  | No ML pipelines; R-only backend                |
| jamovi         | Spreadsheet-first, easy onboarding | Limited to R; no custom visualizations         |
| KNIME          | Powerful analytical engine         | Java/Eclipse UI overwhelming for non-programmers|

## Appendix B: Projected Directory Structure

```
lumina/
├── src-tauri/                    # Tauri Rust shell
│   ├── src/
│   │   └── main.rs              # Tauri app setup, sidecar spawn
│   ├── binaries/                # PyInstaller sidecar output
│   ├── tauri.conf.json
│   └── Cargo.toml
├── src/                         # React frontend
│   ├── components/
│   │   ├── ChartBuilder/
│   │   │   ├── VariableShelf.tsx    # Drag-and-drop drop-zone
│   │   │   └── VariableList.tsx     # Draggable column list with type icons
│   │   ├── DataTable/
│   │   ├── Layout/
│   │   │   ├── ResizablePanels.tsx  # Splitter-based panel layout
│   │   │   └── EmptyState.tsx       # Drop-zone + sample dataset prompts
│   │   ├── Toast/
│   │   │   └── ErrorToast.tsx       # Contextual error notifications
│   │   └── common/
│   ├── platforms/
│   │   ├── eda/
│   │   │   ├── EdaPlatform.tsx
│   │   │   └── useEdaCharts.ts
│   │   └── regression/
│   │       ├── RegressionPlatform.tsx
│   │       └── useRegression.ts
│   ├── stores/
│   │   ├── datasetStore.ts        # Zustand - loaded dataset state
│   │   ├── crossFilterStore.ts    # Zustand - selection indices
│   │   ├── favouriteViewsStore.ts # Zustand - saved view configs
│   │   └── undoRedoStore.ts       # Zustand - action history stack
│   ├── api/
│   │   └── client.ts            # react-query + fetch wrapper
│   ├── App.tsx
│   └── main.tsx
├── backend/                     # FastAPI Python backend
│   ├── app/
│   │   ├── main.py              # FastAPI app + uvicorn entry
│   │   ├── routers/
│   │   │   ├── data.py
│   │   │   ├── eda.py
│   │   │   ├── model.py
│   │   │   ├── project.py
│   │   │   └── views.py
│   │   ├── data/
│   │   │   └── samples/             # Built-in sample datasets
│   │   │       ├── palmer_penguins.csv
│   │   │       ├── titanic.csv
│   │   │       └── iris.csv
│   │   ├── services/
│   │   │   ├── ingestion.py
│   │   │   ├── statistics.py
│   │   │   ├── regression.py
│   │   │   ├── downsampling.py
│   │   │   └── error_translator.py  # Analytical error → user message
│   │   ├── models/              # Pydantic schemas
│   │   │   ├── data.py
│   │   │   ├── chart.py
│   │   │   └── regression.py
│   │   └── session.py           # In-memory dataset store
│   ├── lumina-backend.spec      # PyInstaller spec file
│   └── requirements.txt
├── docs/
│   ├── CONTRIBUTING.md
│   └── architecture.md
├── artifacts/
│   └── specs/
│       └── lumina/
│           └── spec.md          # This file
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── README.md
```
