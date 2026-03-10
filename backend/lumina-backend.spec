# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for packaging the Lumina FastAPI backend as a sidecar."""

from __future__ import annotations

from pathlib import Path

from PyInstaller.building.build_main import Analysis, COLLECT, EXE, PYZ
from PyInstaller.utils.hooks import collect_submodules


PROJECT_ROOT = Path(__file__).resolve().parent
APP_ROOT = PROJECT_ROOT / "app"
ENTRY_SCRIPT = APP_ROOT / "main.py"
SAMPLES_ROOT = APP_ROOT / "data" / "samples"

HIDDEN_IMPORT_ROOTS = [
    "fastapi",
    "uvicorn",
    "pandas",
    "pyarrow",
    "statsmodels",
    "sklearn",
    "openpyxl",
    "plotly",
    "kaleido",
]

# Explicit modules that are frequently resolved dynamically.
EXTRA_HIDDEN_IMPORTS = [
    "uvicorn.logging",
    "uvicorn.loops.auto",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets.auto",
    "pandas._libs.tslibs.timedeltas",
    "pyarrow.lib",
    "statsmodels.api",
    "sklearn.utils._typedefs",
    "openpyxl.cell._writer",
    "plotly.io._kaleido",
    "kaleido.scopes.plotly",
]

hiddenimports = sorted(
    {
        submodule
        for package_root in HIDDEN_IMPORT_ROOTS
        for submodule in collect_submodules(package_root)
    }.union(EXTRA_HIDDEN_IMPORTS)
)

SAMPLE_CSV_FILENAMES = [
    "iris.csv",
    "palmer_penguins.csv",
    "titanic.csv",
]

datas = [
    (str((SAMPLES_ROOT / file_name).resolve()), "app/data/samples")
    for file_name in SAMPLE_CSV_FILENAMES
]

a = Analysis(
    [str(ENTRY_SCRIPT)],
    pathex=[str(PROJECT_ROOT)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="lumina-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="lumina-backend",
)
