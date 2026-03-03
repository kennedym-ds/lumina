# Lumina

> Open-source data visualization and statistical modeling platform for Windows.

Lumina provides interactive exploratory data analysis (EDA) and regression modeling through a point-and-click interface — no coding required.

## Architecture

- **Shell**: Tauri v2 (native window, sidecar lifecycle)
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: FastAPI + pandas + statsmodels + scikit-learn
- **Packaging**: PyInstaller sidecar + Tauri bundler

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

## License

MIT