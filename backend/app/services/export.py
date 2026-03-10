"""Chart export service for rendering Plotly figures to image bytes."""

from __future__ import annotations

import plotly.graph_objects as go


def export_figure(
    figure_dict: dict,
    fmt: str = "png",
    width: int = 1200,
    height: int = 800,
    scale: int = 2,
) -> bytes:
    """Render a Plotly figure dictionary to PNG or SVG bytes."""

    if fmt not in {"png", "svg"}:
        raise ValueError("Unsupported export format")

    fig = go.Figure(figure_dict)
    return fig.to_image(format=fmt, width=width, height=height, scale=scale)
