"""Tests for export service image rendering."""

from app.services.export import export_figure


def _simple_figure() -> dict:
    return {
        "data": [{"type": "scatter", "mode": "markers", "x": [1, 2], "y": [3, 4]}],
        "layout": {"title": {"text": "Simple"}},
    }


def test_export_png_bytes():
    output = export_figure(_simple_figure(), fmt="png", width=640, height=480, scale=1)
    assert isinstance(output, bytes)
    assert output.startswith(b"\x89PNG\r\n\x1a\n")


def test_export_svg_bytes():
    output = export_figure(_simple_figure(), fmt="svg", width=640, height=480, scale=1)
    assert isinstance(output, bytes)
    assert b"<svg" in output.lower()
