#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

"$SCRIPT_DIR/build-backend.sh"

cd "$REPO_ROOT"
npm install
npm run tauri build

BUNDLE_DIR="$REPO_ROOT/src-tauri/target/release/bundle"
echo "[OK] Build complete. Artifacts:"
find "$BUNDLE_DIR" -type f \( -name "*.dmg" -o -name "*.deb" -o -name "*.AppImage" -o -name "*.msi" -o -name "*.exe" \) -exec ls -lh {} \;
