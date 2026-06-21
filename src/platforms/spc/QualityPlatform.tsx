import { useMemo, useState } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import type * as PlotlyTypes from "plotly.js";
import { ApiError } from "@/api/client";
import { useCapability, useControlChart } from "@/api/spc";
import { useDatasetStore } from "@/stores/datasetStore";
import type { ControlChartSeries, ControlChartViolation } from "@/types/spc";

const Plot = createPlotlyComponent(Plotly);

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.userMessage ?? error.detail ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please check your inputs and try again.";
}

function formatIndex(value: number | null): string {
  return value == null ? "—" : value.toFixed(2);
}

function limitShape(y: number, color: string, dash: PlotlyTypes.Dash): Partial<PlotlyTypes.Shape> {
  return {
    type: "line",
    xref: "paper",
    x0: 0,
    x1: 1,
    y0: y,
    y1: y,
    line: { color, width: 1, dash },
  };
}

function vLineShape(x: number, color: string, dash: PlotlyTypes.Dash): Partial<PlotlyTypes.Shape> {
  return {
    type: "line",
    yref: "paper",
    y0: 0,
    y1: 1,
    x0: x,
    x1: x,
    line: { color, width: 1.5, dash },
  };
}

function controlChartFigure(
  series: ControlChartSeries,
  violations: ControlChartViolation[],
): { data: PlotlyTypes.Data[]; layout: Partial<PlotlyTypes.Layout> } {
  const x = series.points.map((_, index) => index + 1);
  const violationSet = new Set(violations.map((v) => v.index));
  const flaggedX = x.filter((_, index) => violationSet.has(index));
  const flaggedY = series.points.filter((_, index) => violationSet.has(index));

  return {
    data: [
      {
        x,
        y: series.points,
        type: "scatter",
        mode: "lines+markers",
        line: { color: "#2563eb", width: 1.5 },
        marker: { color: "#2563eb", size: 5 },
        name: series.name,
        hovertemplate: "#%{x}: %{y:.4g}<extra></extra>",
      },
      {
        x: flaggedX,
        y: flaggedY,
        type: "scatter",
        mode: "markers",
        marker: { color: "#dc2626", size: 9, symbol: "circle-open", line: { width: 2 } },
        name: "Out of control",
        hoverinfo: "skip",
      },
    ],
    layout: {
      autosize: true,
      margin: { l: 48, r: 64, t: 8, b: 28 },
      showlegend: false,
      xaxis: { title: { text: "Observation", font: { size: 11 } }, automargin: true },
      yaxis: { title: { text: series.name, font: { size: 11 } }, automargin: true },
      shapes: [
        limitShape(series.center_line, "#16a34a", "solid"),
        limitShape(series.ucl, "#dc2626", "dash"),
        limitShape(series.lcl, "#dc2626", "dash"),
      ],
      annotations: [
        { xref: "paper", x: 1, y: series.ucl, xanchor: "left", text: "UCL", showarrow: false, font: { size: 9, color: "#dc2626" } },
        { xref: "paper", x: 1, y: series.center_line, xanchor: "left", text: "CL", showarrow: false, font: { size: 9, color: "#16a34a" } },
        { xref: "paper", x: 1, y: series.lcl, xanchor: "left", text: "LCL", showarrow: false, font: { size: 9, color: "#dc2626" } },
      ],
    },
  };
}

const RULE_LABELS: Record<number, string> = {
  1: "beyond 3σ",
  2: "9 in a row one side",
  3: "6 in a row trending",
};

export function QualityPlatform() {
  const datasetId = useDatasetStore((state) => state.datasetId);
  const columns = useDatasetStore((state) => state.columns);
  const numericColumns = useMemo(
    () => columns.filter((column) => column.dtype === "numeric").map((column) => column.name),
    [columns],
  );

  const [column, setColumn] = useState("");
  const [subgroupSize, setSubgroupSize] = useState(1);
  const [lsl, setLsl] = useState("");
  const [usl, setUsl] = useState("");
  const [target, setTarget] = useState("");

  const controlChart = useControlChart(datasetId);
  const capability = useCapability(datasetId);

  const activeColumn = column || numericColumns[0] || "";

  if (!datasetId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        Import a dataset to run control charts and capability analysis.
      </div>
    );
  }

  if (numericColumns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        This dataset has no numeric columns to chart.
      </div>
    );
  }

  const runControlChart = () => {
    controlChart.mutate({ column: activeColumn, subgroup_size: subgroupSize });
  };

  const runCapability = () => {
    capability.mutate({
      column: activeColumn,
      lsl: lsl.trim() === "" ? null : Number(lsl),
      usl: usl.trim() === "" ? null : Number(usl),
      target: target.trim() === "" ? null : Number(target),
      subgroup_size: subgroupSize,
    });
  };

  const cc = controlChart.data;
  const cap = capability.data;

  return (
    <div className="h-full min-h-0 space-y-4 overflow-auto">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-medium text-slate-800">Measurement</span>
            <select
              aria-label="Measurement column"
              value={activeColumn}
              onChange={(event) => setColumn(event.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {numericColumns.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-medium text-slate-800">Subgroup size</span>
            <input
              type="number"
              aria-label="Subgroup size"
              min={1}
              max={25}
              value={subgroupSize}
              onChange={(event) => setSubgroupSize(Math.max(1, Number(event.target.value) || 1))}
              className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={runControlChart}
            disabled={controlChart.isPending}
            className="rounded-md bg-lumina-700 px-4 py-2 text-sm font-medium text-white hover:bg-lumina-800 disabled:opacity-60"
          >
            {controlChart.isPending ? "Building…" : "Build Control Chart"}
          </button>
          <span className="text-xs text-slate-500">
            Subgroup size 1 → Individuals &amp; Moving Range; ≥2 → X̄-R (or X̄-S at ≥9).
          </span>
        </div>

        {controlChart.isError ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {getErrorMessage(controlChart.error)}
          </p>
        ) : null}

        {cc ? (
          <div className="mt-4 space-y-3">
            <div className="rounded border border-slate-200 p-2">
              <Plot
                {...controlChartFigure(cc.primary, cc.violations)}
                useResizeHandler
                style={{ width: "100%", height: "230px" }}
                config={{ responsive: true, displayModeBar: false }}
              />
            </div>
            <div className="rounded border border-slate-200 p-2">
              <Plot
                {...controlChartFigure(cc.secondary, [])}
                useResizeHandler
                style={{ width: "100%", height: "200px" }}
                config={{ responsive: true, displayModeBar: false }}
              />
            </div>
            {cc.violations.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <p className="font-semibold">{cc.violations.length} out-of-control point(s)</p>
                <ul className="mt-1 list-disc pl-5">
                  {cc.violations.slice(0, 8).map((v) => (
                    <li key={v.index}>
                      Point #{v.index + 1} ({v.point.toFixed(3)}) —{" "}
                      {v.rules.map((rule) => RULE_LABELS[rule] ?? `rule ${rule}`).join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-emerald-700">Process appears in statistical control (no run-rule violations).</p>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">Process Capability</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-medium text-slate-800">LSL</span>
            <input
              type="number"
              aria-label="Lower spec limit"
              value={lsl}
              onChange={(event) => setLsl(event.target.value)}
              className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="optional"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-medium text-slate-800">USL</span>
            <input
              type="number"
              aria-label="Upper spec limit"
              value={usl}
              onChange={(event) => setUsl(event.target.value)}
              className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="optional"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-medium text-slate-800">Target</span>
            <input
              type="number"
              aria-label="Target"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="optional"
            />
          </label>
          <button
            type="button"
            onClick={runCapability}
            disabled={capability.isPending}
            className="rounded-md bg-lumina-700 px-4 py-2 text-sm font-medium text-white hover:bg-lumina-800 disabled:opacity-60"
          >
            {capability.isPending ? "Computing…" : "Compute Capability"}
          </button>
        </div>

        {capability.isError ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {getErrorMessage(capability.error)}
          </p>
        ) : null}

        {cap ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["Cp", cap.cp],
                  ["Cpk", cap.cpk],
                  ["Pp", cap.pp],
                  ["Ppk", cap.ppk],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-lg border border-lumina-200 bg-lumina-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-lumina-700">{label}</p>
                  <p className="text-2xl font-bold text-slate-900">{formatIndex(value)}</p>
                </div>
              ))}
              <div className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">
                <p>Mean {cap.mean.toFixed(3)} · σ(within) {cap.std_within.toFixed(3)} · σ(overall) {cap.std_overall.toFixed(3)}</p>
                <p className="mt-1">
                  Est. {Math.round(cap.ppm_total).toLocaleString()} ppm out of spec · {cap.observed_out_of_spec} observed
                </p>
              </div>
            </div>

            <div className="rounded border border-slate-200 p-2">
              <Plot
                data={[
                  {
                    type: "bar",
                    x: cap.histogram.bin_edges.slice(0, -1).map((edge, index) => (edge + cap.histogram.bin_edges[index + 1]) / 2),
                    y: cap.histogram.counts,
                    marker: { color: "#93c5fd" },
                    hovertemplate: "%{x:.4g}: %{y}<extra></extra>",
                  },
                ]}
                layout={{
                  autosize: true,
                  margin: { l: 44, r: 12, t: 8, b: 28 },
                  showlegend: false,
                  bargap: 0.02,
                  xaxis: { title: { text: cap.column, font: { size: 11 } }, automargin: true },
                  yaxis: { title: { text: "Count", font: { size: 11 } }, automargin: true },
                  shapes: [
                    cap.lsl != null ? vLineShape(cap.lsl, "#dc2626", "dash") : null,
                    cap.usl != null ? vLineShape(cap.usl, "#dc2626", "dash") : null,
                    cap.target != null ? vLineShape(cap.target, "#16a34a", "dot") : null,
                  ].filter((shape): shape is Partial<PlotlyTypes.Shape> => shape !== null),
                }}
                useResizeHandler
                style={{ width: "100%", height: "240px" }}
                config={{ responsive: true, displayModeBar: false }}
              />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
