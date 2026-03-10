# Contributing to Lumina

Thank you for your interest in contributing. This guide covers development setup, codebase conventions, and the process for adding new features.

## Table of Contents

- [Development Setup](#development-setup)
- [Repository Layout](#repository-layout)
- [Adding a New Platform](#adding-a-new-platform)
- [Adding a New Chart Type](#adding-a-new-chart-type)
- [Adding a Backend Endpoint](#adding-a-backend-endpoint)
- [Testing](#testing)
- [Code Style](#code-style)
- [PR Workflow](#pr-workflow)

---

## Development Setup

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| [Node.js](https://nodejs.org/) | 20+ | LTS recommended |
| [Rust](https://rustup.rs/) | stable | `rustup default stable` |
| [Python](https://python.org/) | 3.11+ | |
| Visual Studio C++ Build Tools | Latest | Required for Tauri/Rust compilation on Windows |

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

In development, Tauri skips sidecar spawning (`#[cfg(debug_assertions)]`). The frontend reads `window.__LUMINA_API_PORT__` (injected by the Tauri shell setup hook) and falls back to port `8089`.

### Build for Release

```powershell
# Package the Python backend as a PyInstaller binary
.\scripts\build-backend.ps1

# Build the Tauri installer (bundles the sidecar automatically)
npm run tauri build
```

The resulting installer is written to `src-tauri/target/release/bundle/`.

---

## Repository Layout

```
lumina/
├── src/                  # React frontend (TypeScript)
│   ├── api/              # HTTP client wrappers
│   ├── components/       # Shared UI components
│   ├── hooks/            # Custom React hooks
│   ├── platforms/        # Feature areas (EDA, Regression)
│   │   └── registry.ts   # Platform registry — add new platforms here
│   ├── services/         # Project serialization
│   ├── stores/           # Zustand state slices
│   └── types/            # Shared TypeScript types
├── src-tauri/            # Tauri shell (Rust)
├── backend/              # FastAPI backend (Python)
│   ├── app/
│   │   ├── main.py       # App factory
│   │   ├── session.py    # In-memory DatasetSession store
│   │   ├── middleware/   # Auth middleware
│   │   └── routers/      # API routers
│   └── tests/            # pytest test suite
├── scripts/              # Development and build scripts
└── docs/                 # Documentation
```

---

## Adding a New Platform

A _platform_ is a top-level feature area (e.g., Charts, Regression) selectable from the sidebar.

**1. Create the platform component**

Create a folder under `src/platforms/<name>/` and export a default React component:

```typescript
// src/platforms/myscenario/MyScenarioPlatform.tsx
export function MyScenarioPlatform() {
  return <div>My platform content</div>;
}
```

**2. Register the platform**

Add an entry to the `platforms` array in `src/platforms/registry.ts`:

```typescript
import { lazy } from "react";

export const platforms: PlatformEntry[] = [
  // ... existing entries ...
  {
    id: "myscenario",
    label: "My Scenario",
    icon: "🔬",
    component: lazy(() =>
      import("@/platforms/myscenario/MyScenarioPlatform").then((m) => ({
        default: m.MyScenarioPlatform,
      }))
    ),
  },
];
```

The `id` must be unique. The component is lazy-loaded; Vite code-splits it automatically.

**3. Add state if needed**

If the platform needs persistent state, create a Zustand store in `src/stores/<name>Store.ts` following the pattern in `chartStore.ts` or `regressionStore.ts`.

**4. Add backend endpoints if needed**

Follow [Adding a Backend Endpoint](#adding-a-backend-endpoint) below.

---

## Adding a New Chart Type

Chart types are enumerated in `src/types/eda.ts`. To add a new one:

**1. Extend the type union**

```typescript
// src/types/eda.ts
export type ChartType =
  | "scatter"
  | "bar"
  | "histogram"
  | "box"
  | "heatmap"
  | "mycharttype";   // add here
```

**2. Handle the new type in the EDA platform**

The chart rendering logic reads `chartConfig.chartType` to build Plotly traces. Add a case to the trace-building switch statement in `src/platforms/eda/`.

**3. Add backend aggregation logic**

The `/api/eda/chart` endpoint computes aggregations per chart type. Add the server-side logic to `backend/app/routers/eda.py`.

**4. Update the chart type selector**

Add a button or option in `src/components/ChartBuilder/` so users can select the new type.

---

## Adding a Backend Endpoint

**1. Choose or create a router**

Routers live in `backend/app/routers/`. Use an existing router if the endpoint belongs to an existing resource (data, eda, model, project, views), or create a new file:

```python
# backend/app/routers/myresource.py
from fastapi import APIRouter

router = APIRouter(prefix="/api/myresource", tags=["myresource"])

@router.get("/items")
async def list_items():
    return {"items": []}
```

**2. Register the router in `main.py`**

```python
# backend/app/main.py
from app.routers.myresource import router as myresource_router

# inside create_app():
app.include_router(myresource_router)
```

**3. Access the session store**

Inject the session store via FastAPI dependency injection:

```python
from app.session import SessionStore, session_store

@router.post("/process/{dataset_id}")
async def process(dataset_id: str, store: SessionStore = Depends(lambda: session_store)):
    session = store.get(dataset_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    # work with session.dataframe
```

**4. Add a frontend API wrapper**

Create or extend a file in `src/api/` to call the new endpoint:

```typescript
// src/api/myresource.ts
import { apiClient } from "./client";

export function fetchItems(): Promise<ItemsResponse> {
  return apiClient.get<ItemsResponse>("/api/myresource/items");
}
```

Use React Query to integrate it into a component:

```typescript
const { data } = useQuery({
  queryKey: ["myresource-items"],
  queryFn: fetchItems,
});
```

**5. Write tests**

Add a pytest test module at `backend/tests/test_myresource.py`. See existing test files for fixture and client patterns.

---

## Testing

### Frontend

```powershell
# Run all frontend tests (Vitest)
npm test

# Run in watch mode
npm run test:watch

# Type-check without emitting
npx tsc --noEmit
```

Tests live in `src/**/__tests__/`. Use `describe` / `it` blocks with `@testing-library/react` for component tests.

### Backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1

# Run all tests
python -m pytest tests/ -q

# Run a specific test file
python -m pytest tests/test_data_routes.py -v

# Run with coverage
python -m pytest tests/ --cov=app --cov-report=term-missing
```

Tests live in `backend/tests/`. Use the `client` fixture from `conftest.py` for HTTP tests.

### NFR Validation

```powershell
# Validate non-functional requirements (startup time, localhost binding, import performance)
.\scripts\nfr-validate.ps1 -SkipBuild
```

Remove `-SkipBuild` in a release-prep environment to also enforce the installer size budget.

---

## Code Style

### TypeScript

- **Strict mode** is enabled (`tsconfig.json`). All types must be explicit; avoid `any`.
- Use named exports. Avoid default exports except for lazy-loaded platform components.
- Prefer `type` over `interface` for data shapes; use `interface` for extension points (e.g., `PlatformEntry`).
- Tailwind CSS for all styling. No inline `style` props except for dynamic values (e.g., computed widths).
- React Query for all server state. Zustand for local UI state. Do not use `useState` for data that belongs in a store.

### Python

- Python 3.11+ type hints are required on all functions and dataclass fields.
- Follow [PEP 8](https://peps.python.org/pep-0008/) formatting. A `ruff` or `black` formatter run is acceptable.
- Use `dataclasses` for value objects (see `DatasetSession`). Use Pydantic models for request/response bodies.
- Raise `HTTPException` with structured `detail` strings for all API errors.
- Use `async def` for FastAPI route handlers; do CPU-bound pandas work in a thread pool if the operation is long-running.

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]
```

Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.

Examples:

```
feat(eda): add violin chart type
fix(regression): handle empty predictor list gracefully
docs(contributing): add backend endpoint walkthrough
test(data): add pagination edge-case tests
```

---

## PR Workflow

### Branch Naming

```
feat/<short-description>
fix/<short-description>
docs/<short-description>
chore/<short-description>
```

### Before Opening a PR

1. Run `npx tsc --noEmit` — zero TypeScript errors required.
2. Run `npm test` — all frontend tests must pass.
3. Run `python -m pytest tests/ -q` from `backend/` — all backend tests must pass.
4. Self-review your diff for unintended changes or debug artifacts.

### Review Expectations

- Each PR should be focused: one feature or fix per PR.
- Include tests for new behaviour.
- Update `docs/` if you change architecture, add a platform, or add public API endpoints.
- Add a `CHANGELOG.md` entry under `[Unreleased]` following the [Keep a Changelog](https://keepachangelog.com) format.
