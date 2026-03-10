"""Tests for the PyInstaller spec used to build the backend sidecar."""

from __future__ import annotations

import ast
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = BACKEND_ROOT / "lumina-backend.spec"


def _parse_spec() -> ast.Module:
    spec_text = SPEC_PATH.read_text(encoding="utf-8")
    return ast.parse(spec_text)


def _extract_string_list(module: ast.Module, variable_name: str) -> list[str]:
    for node in module.body:
        if not isinstance(node, ast.Assign):
            continue

        if len(node.targets) != 1:
            continue

        target = node.targets[0]
        if not isinstance(target, ast.Name) or target.id != variable_name:
            continue

        if not isinstance(node.value, (ast.List, ast.Tuple)):
            return []

        values: list[str] = []
        for element in node.value.elts:
            if isinstance(element, ast.Constant) and isinstance(element.value, str):
                values.append(element.value)
        return values

    return []


def test_spec_file_exists_and_is_valid_python() -> None:
    assert SPEC_PATH.exists(), f"Expected spec file at {SPEC_PATH}"
    _parse_spec()


def test_spec_hidden_import_roots_cover_critical_packages() -> None:
    module = _parse_spec()
    hidden_import_roots = set(_extract_string_list(module, "HIDDEN_IMPORT_ROOTS"))

    expected_roots = {
        "fastapi",
        "uvicorn",
        "pandas",
        "pyarrow",
        "statsmodels",
        "sklearn",
        "openpyxl",
        "plotly",
        "kaleido",
    }

    missing = expected_roots - hidden_import_roots
    assert not missing, f"Missing hidden import roots in spec: {sorted(missing)}"


def test_spec_sample_data_file_declarations_cover_csv_bundle() -> None:
    module = _parse_spec()
    sample_csvs = set(_extract_string_list(module, "SAMPLE_CSV_FILENAMES"))

    expected_csvs = {
        "iris.csv",
        "palmer_penguins.csv",
        "titanic.csv",
    }

    missing_csvs = expected_csvs - sample_csvs
    assert not missing_csvs, f"Missing sample CSV declarations in spec: {sorted(missing_csvs)}"

    constant_strings = {
        node.value
        for node in ast.walk(module)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    }
    assert "app/data/samples" in constant_strings
