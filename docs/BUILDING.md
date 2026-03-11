---
title: "Building Lumina installers"
version: "1.0.0"
lastUpdated: "2026-03-11"
status: "active"
---

Use this guide to build Lumina from source and produce standalone desktop installers for Windows, macOS, and Linux.

AI assistance: Drafted with GitHub Copilot. Review owner: Lumina maintainers.

## Overview

Lumina packages a Tauri desktop shell with a PyInstaller-built FastAPI sidecar.

Relevant files:

- `scripts/build-backend.ps1` — Windows backend sidecar build and staging.
- `scripts/build-backend.sh` — macOS/Linux backend sidecar build and staging.
- `scripts/build-tauri.ps1` — Windows installer build.
- `scripts/build-tauri.sh` — macOS/Linux installer build.
- `backend/lumina-backend.spec` — PyInstaller spec for the backend sidecar.
- `src-tauri/tauri.conf.json` — Tauri bundling and sidecar resource configuration.
- `.github/workflows/build-installers.yml` — Cross-platform installer workflow.
- `docs/architecture.md` — Architecture overview for the desktop shell and sidecar model.

## Prerequisites

### Common requirements

- Node.js 20 or later
- Python 3.11 or later
- Rust stable toolchain with Cargo
- Git

### Windows

- Visual Studio C++ Build Tools
- PowerShell 7 or Windows PowerShell for the provided `.ps1` scripts
- A backend virtual environment at `backend/.venv`

### macOS

- Xcode Command Line Tools
- `python3` available on `PATH`

### Linux

Install the Tauri system dependencies before building:

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```

## Development setup

Install frontend dependencies:

```powershell
npm install
```

Create the backend virtual environment and install dev dependencies on Windows:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
cd ..
```

Create the backend virtual environment and install dev dependencies on macOS/Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
cd ..
```

## Building on Windows

Build the backend sidecar only:

```powershell
pwsh scripts/build-backend.ps1
```

Build the desktop installer:

```powershell
pwsh scripts/build-tauri.ps1
```

Artifacts are written to `src-tauri/target/release/bundle/`.

## Building on macOS

Build the backend sidecar only:

```bash
bash scripts/build-backend.sh
```

Build the desktop installer:

```bash
bash scripts/build-tauri.sh
```

Expected installer artifact: `.dmg`

## Building on Linux

Build the backend sidecar only:

```bash
bash scripts/build-backend.sh
```

Build the desktop installer:

```bash
bash scripts/build-tauri.sh
```

Expected installer artifacts: `.deb` and `.AppImage`

## CI/CD

The cross-platform workflow lives in `.github/workflows/build-installers.yml`.

- Runs on tag pushes matching `v*`
- Supports manual execution through `workflow_dispatch`
- Builds installers on Windows, macOS, and Linux
- Uploads bundle artifacts for each target
- Creates a draft GitHub Release for tagged builds

## Troubleshooting

### PyInstaller build fails with missing modules

- Confirm `backend/requirements.txt` is current.
- Rebuild with a clean environment using the provided build scripts.
- Check `backend/lumina-backend.spec` for missing hidden imports.

### Tauri build fails on Linux

- Verify the WebKit and tray dependencies are installed.
- Confirm `patchelf` is available.

### Backend sidecar is not bundled

- Confirm the sidecar was staged into `src-tauri/binaries/`.
- Confirm `src-tauri/tauri.conf.json` includes `binaries/lumina-backend-*/**` in `bundle.resources`.
- Confirm the shell plugin sidecar command remains `binaries/lumina-backend`.

### Windows build script cannot find Python

- Verify the Windows build environment has Python 3.11 installed.
- Verify `backend/.venv` exists for local development commands.
- For release builds, use the clean build environment created by `scripts/build-backend.ps1`.

### Release artifacts are missing

- Check `src-tauri/target/release/bundle/` after a local build.
- In GitHub Actions, inspect the uploaded artifact bundle for the target platform.
- Verify the tag matches the `v*` pattern expected by the installer workflow.
