import { useEffect, useMemo, useState } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import type { PlotData } from "plotly.js";
import { useDistribution } from "@/api/eda";
import { useDatasetStore } from "@/stores/datasetStore";

const Plot = createPlotlyComponent(Plotly);

type DistributionTrace = Partial<PlotData> & {
  type: "scatter";
  mode: "lines";
  name: string;
  x: number[];
  y: number[];
};

export function DistributionOverlay() {
  const datasetId = useDatasetStore((state) => state.datasetId);
  const columns = useDatasetStore((state) => state.columns);

  const numericColumns = useMemo(() => columns.filter((column) => column.dtype === "numeric"), [columns]);
  const groupColumns = useMemo(
    () => columns.filter((column) => column.dtype === "categorical" || column.dtype === "boolean"),
    [columns],
  );

  const [column, setColumn] = useState<string>("");
  const [groupBy, setGroupBy] = useState<string>("");

  useEffect(() => {
    setColumn(numericColumns[0]?.name ?? "");
    setGroupBy(groupColumns[0]?.name ?? "");
  }, [datasetId, numericColumns, groupColumns]);

  useEffect(() => {
    if (column && numericColumns.some((candidate) => candidate.name === column)) {
      return;
    }

    setColumn(numericColumns[0]?.name ?? "");
  }, [column, numericColumns]);

  useEffect(() => {
    if (!groupBy || groupColumns.some((candidate) => candidate.name === groupBy)) {
      return;
    }

    setGroupBy(groupColumns[0]?.name ?? "");
  }, [groupBy, groupColumns]);

  const distribution = useDistribution(datasetId, column || null, groupBy || null);

  const traces = useMemo<DistributionTrace[]>(() => {
    const response = distribution.data;
    if (!response) {
      return [];
    }

    return response.traces.map((trace) => ({
      type: "scatter",
      mode: "lines",
      name: trace.group,
      x: trace.x,
      y: trace.y,
    }));
  }, [distribution.data]);

  if (!datasetId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        Import a dataset to compare distributions.
      </div>
    );
  }

  if (numericColumns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
        No numeric columns available for distribution comparison.
      </div>
    );
  }

  return (
    <section className="h-full overflow-auto rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-medium text-slate-800">Distribution comparison</h2>
          <p className="text-xs text-slate-500">
            Compare smoothed density curves for a numeric column across up to 10 groups.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            <span>Numeric column</span>
            <select
              aria-label="Numeric column"
              value={column}
              onChange={(event) => setColumn(event.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {numericColumns.map((candidate) => (
                <option key={candidate.name} value={candidate.name}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-500">
            <span>Group by column</span>
            <select
              aria-label="Group by column"
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="">None</option>
              {groupColumns.map((candidate) => (
                <option key={candidate.name} value={candidate.name}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {distribution.isLoading ? <div className="text-sm text-slate-500">Computing KDE traces…</div> : null}

      {distribution.error ? (
        <div className="text-sm text-red-600">Failed to compute distributions: {distribution.error.message}</div>
      ) : null}

      {!distribution.isLoading && !distribution.error && traces.length === 0 ? (
        <div className="text-sm text-slate-500">No valid distribution traces for the selected columns.</div>
      ) : null}

      {traces.length > 0 ? (
        <div className="min-h-[420px] w-full">
          <Plot
            data={traces}
            layout={{
              autosize: true,
              height: 420,
              margin: { l: 56, r: 24, t: 48, b: 56 },
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              legend: { orientation: "h", y: 1.12 },
              title: {
                text: groupBy ? `Distribution comparison: ${column} by ${groupBy}` : `Distribution comparison: ${column}`,
              },
              xaxis: { title: { text: distribution.data?.column ?? column } },
              yaxis: { title: { text: "Density" } },
            }}
            config={{ responsive: true, displayModeBar: false }}
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      ) : null}
    </section>
  );
}

export default DistributionOverlay;