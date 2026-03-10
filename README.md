# Lumina

> Open-source data visualization and statistical modeling platform for Windows.

Lumina provides interactive exploratory data analysis (EDA) and regression modeling through a point-and-click interface — no coding required.

## Features

- **Data Ingestion** — Import CSV/XLSX files by drag-and-drop; Apache Arrow columnar storage handles 100K+ rows efficiently.
- **Data Table** — Virtual-scrolling grid with sortable columns, automatic type detection, and per-column summary statistics.
- **Chart Builder** — Drag-and-drop variable shelves for scatter, bar, histogram, box, and heatmap charts; WebGL rendering for large datasets.
- **Cross-Filtering** — Click any chart selection to filter all linked charts simultaneously.
- **Regression Platform** — OLS and logistic regression with diagnostic plots, confusion matrix, and ROC curves.
- **Project Persistence** — Save/load `.lumina` project files; export charts as PNG or SVG.
- **UX Polish** — Sample datasets (penguins, iris, titanic), undo/redo, favourite views, resizable panels, colorblind-safe palette.
- **Security** — Per-session bearer token auth, localhost-only binding, CORS restricted to Tauri origins.

## Screenshots

| Chart Builder | Regression Platform |
|---------------|---------------------|
| ![Chart Builder](docs/screenshots/chart-builder.png) | ![Regression](docs/screenshots/regression.png) |

## Architecture

- **Shell**: Tauri v2 (native window, sidecar lifecycle)
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: FastAPI + pandas + statsmodels + scikit-learn
- **Packaging**: PyInstaller sidecar + Tauri bundler

See [docs/architecture.md](docs/architecture.md) for a full system overview including component diagrams, data flow sequences, and the security model.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (stable toolchain)
- [Python](https://python.org/) 3.11+
- Visual Studio C++ Build Tools (for Tauri/Rust compilation on Windows)

### Quick Start

```powershell
# 1. Install frontend dependencies
npm install

# 2. Set up Python virtual environment
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
cd ..

# 3. Start the backend (terminal 1)
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8089 --reload

# 4. Start Tauri dev mode (terminal 2)
npm run tauri dev
```

### Build for Release

```powershell
# Package the Python backend as a standalone binary
.\scripts\build-backend.ps1

# Build the Tauri installer (bundles the sidecar automatically)
npm run tauri build
```

The installer is written to `src-tauri/target/release/bundle/`.

### Project Structure

```
lumina/
├── src/                  # React frontend (TypeScript)
├── src-tauri/            # Tauri shell (Rust)
├── backend/              # FastAPI backend (Python)
│   └── app/
├── scripts/              # Development and build scripts
├── artifacts/            # Specs, plans, research
└── docs/                 # Documentation
```

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for development setup, coding conventions, and the PR workflow.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a full list of changes by release.

## License

MIT