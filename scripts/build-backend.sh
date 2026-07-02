#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_ROOT="$REPO_ROOT/backend"
BUILD_VENV="$BACKEND_ROOT/.venv-build"
SPEC_PATH="$BACKEND_ROOT/lumina-backend.spec"

SIDECAR_ROOT="$REPO_ROOT/src-tauri/sidecar"
FINAL_DIR="$SIDECAR_ROOT/lumina-backend"

echo "[INFO] Building backend sidecar (onedir)"

rm -rf "$BUILD_VENV"
python3 -m venv "$BUILD_VENV"
source "$BUILD_VENV/bin/activate"

pip install --upgrade pip
pip install -r "$BACKEND_ROOT/requirements.txt"
pip install "pyinstaller>=6,<7"

cd "$BACKEND_ROOT"
python -m PyInstaller --noconfirm --clean "$SPEC_PATH"

DIST_DIR="$BACKEND_ROOT/dist/lumina-backend"
if [ ! -d "$DIST_DIR" ]; then
    echo "[ERROR] Expected PyInstaller onedir output not found: $DIST_DIR" >&2
    exit 1
fi

rm -rf "$FINAL_DIR"
mkdir -p "$SIDECAR_ROOT"
cp -r "$DIST_DIR" "$FINAL_DIR"

SIZE=$(du -sh "$FINAL_DIR" | cut -f1)
echo "[OK] Sidecar staged at: $FINAL_DIR ($SIZE)"
