#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_ROOT="$REPO_ROOT/backend"
BUILD_VENV="$BACKEND_ROOT/.venv-build"
SPEC_PATH="$BACKEND_ROOT/lumina-backend.spec"

case "$(uname -s)-$(uname -m)" in
    Darwin-arm64)  TARGET="aarch64-apple-darwin" ;;
    Darwin-x86_64) TARGET="x86_64-apple-darwin" ;;
    Linux-x86_64)  TARGET="x86_64-unknown-linux-gnu" ;;
    Linux-aarch64) TARGET="aarch64-unknown-linux-gnu" ;;
    *)             echo "Unsupported platform"; exit 1 ;;
esac

TAURI_BIN_DIR="$REPO_ROOT/src-tauri/binaries"
TARGET_DIR="$TAURI_BIN_DIR/lumina-backend-$TARGET"
TARGET_EXE="$TARGET_DIR/lumina-backend-$TARGET"

echo "[INFO] Building for target: $TARGET"

rm -rf "$BUILD_VENV"
python3 -m venv "$BUILD_VENV"
source "$BUILD_VENV/bin/activate"

pip install --upgrade pip
pip install -r "$BACKEND_ROOT/requirements.txt"
pip install "pyinstaller>=6,<7"

cd "$BACKEND_ROOT"
python -m PyInstaller --noconfirm --clean "$SPEC_PATH"

DIST_DIR="$BACKEND_ROOT/dist/lumina-backend"
rm -rf "$TARGET_DIR"
cp -r "$DIST_DIR" "$TARGET_DIR"

mv "$TARGET_DIR/lumina-backend" "$TARGET_EXE"
chmod +x "$TARGET_EXE"

echo "[OK] Sidecar staged at: $TARGET_DIR"
du -sh "$TARGET_DIR"
