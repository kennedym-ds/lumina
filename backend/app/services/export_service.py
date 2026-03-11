"""Dataset export helpers for tabular downloads and analysis reports."""

from __future__ import annotations

import io
from datetime import datetime

import pandas as pd


def export_dataframe_csv(df: pd.DataFrame) -> bytes:
    """Export a DataFrame as UTF-8 CSV bytes."""

    return df.to_csv(index=False).encode("utf-8")


def export_dataframe_excel(df: pd.DataFrame) -> bytes:
    """Export a DataFrame as XLSX bytes using openpyxl."""

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)
    buffer.seek(0)
    return buffer.read()


def generate_summary_report(
    profile_data: dict | None,
    chart_configs: list[dict],
    inference_results: list[dict] | None,
    regression_summary: dict | None,
) -> str:
    """Generate a Markdown summary report for the current analysis session."""

    lines = ["# Lumina Analysis Report", "", f"Generated: {datetime.now().isoformat()}", ""]

    if profile_data:
        lines.extend(
            [
                "## Data Profile",
                "",
                f"- Rows: {profile_data.get('row_count', 'N/A')}",
                f"- Columns: {profile_data.get('column_count', 'N/A')}",
                f"- Duplicate rows: {profile_data.get('duplicate_row_count', 'N/A')}",
                f"- Memory bytes: {profile_data.get('total_memory_bytes', 'N/A')}",
            ]
        )

        columns = profile_data.get("columns") or []
        if columns:
            lines.extend(["", "### Profile highlights", ""])
            for column in columns[:5]:
                lines.append(
                    "- "
                    f"{column.get('name', 'Unknown')} "
                    f"({column.get('dtype', 'unknown')}), "
                    f"missing={column.get('missing_count', 0)}, "
                    f"unique={column.get('unique_count', 'N/A')}"
                )

        lines.append("")

    if chart_configs:
        lines.extend(["## Charts", ""])
        for index, chart in enumerate(chart_configs, start=1):
            chart_type = chart.get("chart_type", "Unknown")
            axes = []
            if chart.get("x"):
                axes.append(f"x={chart['x']}")
            if chart.get("y"):
                axes.append(f"y={chart['y']}")
            if chart.get("color"):
                axes.append(f"color={chart['color']}")
            if chart.get("facet"):
                axes.append(f"facet={chart['facet']}")
            if chart.get("values"):
                axes.append(f"values={chart['values']}")
            if chart.get("aggregation"):
                axes.append(f"aggregation={chart['aggregation']}")

            lines.append(f"### Chart {index}: {chart_type}")
            lines.append("")
            lines.append(f"- Configuration: {', '.join(axes) if axes else 'No mapped fields'}")
            lines.append("")

    if inference_results:
        lines.extend(["## Statistical Tests", ""])
        for index, result in enumerate(inference_results, start=1):
            label = result.get("kind") or result.get("test_type") or result.get("column") or "Test"
            lines.append(f"### Result {index}: {label}")
            lines.append("")

            if result.get("test_type"):
                lines.append(f"- Test type: {result['test_type']}")
            if result.get("column"):
                lines.append(f"- Column: {result['column']}")
            if result.get("column_a"):
                lines.append(f"- Column A: {result['column_a']}")
            if result.get("column_b"):
                lines.append(f"- Column B: {result['column_b']}")
            if result.get("group_column"):
                lines.append(f"- Group column: {result['group_column']}")
            if result.get("statistic") is not None:
                lines.append(f"- Statistic: {result['statistic']}")
            if result.get("p_value") is not None:
                lines.append(f"- P-value: {result['p_value']}")
            if result.get("credible_level") is not None:
                lines.append(f"- Credible level: {result['credible_level']}")
            if result.get("bayes_factor_10") is not None:
                lines.append(f"- Bayes factor (BF10): {result['bayes_factor_10']}")

            lines.append("")

    if regression_summary:
        lines.extend(["## Regression Model", ""])
        lines.append(f"- Model type: {regression_summary.get('model_type', 'N/A')}")
        lines.append(f"- Dependent variable: {regression_summary.get('dependent', 'N/A')}")

        independents = regression_summary.get("independents") or []
        lines.append(f"- Independent variables: {', '.join(independents) if independents else 'N/A'}")

        if regression_summary.get("r_squared") is not None:
            lines.append(f"- R-squared: {regression_summary['r_squared']}")
        if regression_summary.get("rmse") is not None:
            lines.append(f"- RMSE: {regression_summary['rmse']}")
        if regression_summary.get("mae") is not None:
            lines.append(f"- MAE: {regression_summary['mae']}")
        if regression_summary.get("n_observations") is not None:
            lines.append(f"- Observations: {regression_summary['n_observations']}")

        lines.append("")

    return "\n".join(lines).rstrip() + "\n"