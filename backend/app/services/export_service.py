"""Dataset export helpers for tabular downloads and analysis reports."""

from __future__ import annotations

import html as html_lib
import io
from datetime import datetime
from typing import Any

import pandas as pd

# Leading characters a spreadsheet (Excel, Sheets, LibreOffice) may interpret as a
# formula. A malicious dataset cell like ``=HYPERLINK(...)`` or ``=cmd|...`` would
# execute when the exported file is opened, so we neutralise them on export.
_FORMULA_TRIGGERS = ("=", "+", "-", "@", "\t", "\r")


def _escape_formula_value(value: Any) -> Any:
    if isinstance(value, str) and value.startswith(_FORMULA_TRIGGERS):
        return "'" + value
    return value


def _sanitize_for_spreadsheet(df: pd.DataFrame) -> pd.DataFrame:
    """Return a copy with formula-triggering string cells and headers escaped.

    Numeric/datetime cells cannot carry formulas, so only text-bearing columns and
    the column headers are touched. This is CSV/formula-injection (CWE-1236) defence.
    """

    safe = df.copy()
    for column in safe.columns:
        if safe[column].dtype == object or pd.api.types.is_string_dtype(safe[column]):
            safe[column] = safe[column].map(_escape_formula_value)
    safe.columns = pd.Index([_escape_formula_value(str(column)) for column in safe.columns])
    return safe


def export_dataframe_csv(df: pd.DataFrame) -> bytes:
    """Export a DataFrame as UTF-8 CSV bytes."""

    return _sanitize_for_spreadsheet(df).to_csv(index=False).encode("utf-8")


def export_dataframe_excel(df: pd.DataFrame) -> bytes:
    """Export a DataFrame as XLSX bytes using openpyxl."""

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        _sanitize_for_spreadsheet(df).to_excel(writer, index=False)
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


def _markdown_to_html_body(markdown: str) -> str:
    """Convert the subset of Markdown our report emits (h1-h3, lists, paragraphs)
    into escaped HTML. Intentionally minimal — the report generator only uses
    these constructs, so a full Markdown parser would be overkill."""

    out: list[str] = []
    in_list = False

    def close_list() -> None:
        nonlocal in_list
        if in_list:
            out.append("</ul>")
            in_list = False

    for raw in markdown.split("\n"):
        line = raw.rstrip()
        if not line.strip():
            close_list()
            continue
        if line.startswith("### "):
            close_list()
            out.append(f"<h3>{html_lib.escape(line[4:])}</h3>")
        elif line.startswith("## "):
            close_list()
            out.append(f"<h2>{html_lib.escape(line[3:])}</h2>")
        elif line.startswith("# "):
            close_list()
            out.append(f"<h1>{html_lib.escape(line[2:])}</h1>")
        elif line.startswith("- "):
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{html_lib.escape(line[2:])}</li>")
        else:
            close_list()
            out.append(f"<p>{html_lib.escape(line)}</p>")

    close_list()
    return "\n".join(out)


_REPORT_CSS = """
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1e293b;
         max-width: 820px; margin: 2rem auto; padding: 0 1.5rem; line-height: 1.55; }
  h1 { font-size: 1.6rem; border-bottom: 2px solid #6366f1; padding-bottom: .3rem; }
  h2 { font-size: 1.2rem; margin-top: 1.8rem; color: #4338ca; }
  h3 { font-size: 1rem; margin-top: 1.1rem; color: #334155; }
  ul { padding-left: 1.3rem; } li { margin: .15rem 0; }
  p { margin: .4rem 0; }
  @media print { body { margin: 0; } }
"""


def generate_html_report(
    profile_data: dict | None,
    chart_configs: list[dict],
    inference_results: list[dict] | None,
    regression_summary: dict | None,
) -> str:
    """Produce a self-contained, printable HTML analysis report.

    Reuses ``generate_summary_report`` for content so the HTML and Markdown
    exports never drift apart. The result has no external assets, so the webview
    can render it and the user can print/save it to PDF.
    """

    markdown = generate_summary_report(profile_data, chart_configs, inference_results, regression_summary)
    body = _markdown_to_html_body(markdown)
    return (
        "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n"
        "<meta charset=\"utf-8\" />\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n"
        "<title>Lumina Analysis Report</title>\n"
        f"<style>{_REPORT_CSS}</style>\n</head>\n<body>\n{body}\n</body>\n</html>\n"
    )


def export_inference_results(results: list[dict]) -> tuple[str, bytes]:
    """Export inference result history as Markdown report + CSV bytes.

    Returns a tuple of (markdown_text, csv_bytes).
    """
    if not results:
        return "# Inference Results\n\nNo results recorded.\n", b""

    lines = ["# Inference Results\n"]

    for i, r in enumerate(results, 1):
        test_type = r.get("test_type", "unknown")
        lines.append(f"## {i}. {test_type}\n")
        for key, value in r.items():
            if key == "test_type":
                continue
            lines.append(f"- **{key}**: {value}")
        lines.append("")

    markdown = "\n".join(lines)

    # CSV from flat dicts
    flat_rows = []
    for r in results:
        flat: dict = {}
        for k, v in r.items():
            if isinstance(v, (list, dict)):
                flat[k] = str(v)
            else:
                flat[k] = v
        flat_rows.append(flat)

    buf = io.BytesIO()
    _sanitize_for_spreadsheet(pd.DataFrame(flat_rows)).to_csv(buf, index=False)
    csv_bytes = buf.getvalue()

    return markdown, csv_bytes