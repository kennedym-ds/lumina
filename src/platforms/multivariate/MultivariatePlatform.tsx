import { useMemo, useState } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import { ApiError } from "@/api/client";
import { useClustering, usePca } from "@/api/multivariate";
import { useDatasetStore } from "@/stores/datasetStore";

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

export function MultivariatePlatform() {
  const datasetId = useDatasetStore((state) => state.datasetId);
  const columns = useDatasetStore((state) => state.columns);
  const numericColumns = useMemo(
    () => columns.filter((column) => column.dtype === "numeric").map((column) => column.name),
    [columns],
  );

  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [nClusters, setNClusters] = useState(3);

  const pca = usePca(datasetId);
  const clustering = useClustering(datasetId);

  const activeColumns = selectedColumns.length > 0 ? selectedColumns : numericColumns;

  if (!datasetId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        Import a dataset to run PCA and clustering analysis.
      </div>
    );
  }

  if (numericColumns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        This dataset has no numeric columns for multivariate analysis.
      </div>
    );
  }

  const toggleColumn = (name: string) => {
    setSelectedColumns((prev) => {
      // An empty selection means "all numeric columns" (see `activeColumns`), and the
      // checkboxes render as checked in that state. Expand it to the explicit list
      // before toggling so unchecking a box removes that column instead of adding it.
      const current = prev.length > 0 ? prev : numericColumns;
      return current.includes(name) ? current.filter((c) => c !== name) : [...current, name];
    });
  };

  const runPca = () => {
    pca.mutate({ columns: activeColumns });
  };

  const runClustering = () => {
    clustering.mutate({ columns: activeColumns, n_clusters: nClusters });
  };

  const pcaResult = pca.data;
  const clusterResult = clustering.data;

  return (
    <div className="h-full min-h-0 space-y-4 overflow-auto">
      {/* Column selection */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">Select Columns</h3>
        <p className="mt-1 text-xs text-slate-500">
          Choose numeric columns to include (defaults to all numeric columns).
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {numericColumns.map((name) => (
            <label key={name} className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                aria-label={`Include column ${name}`}
                checked={selectedColumns.length === 0 || selectedColumns.includes(name)}
                onChange={() => toggleColumn(name)}
                className="rounded border-slate-300"
              />
              {name}
            </label>
          ))}
        </div>
      </section>

      {/* PCA section */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Principal Component Analysis</h3>
            <p className="text-xs text-slate-500">Standardizes the data then decomposes variance.</p>
          </div>
          <button
            type="button"
            onClick={runPca}
            disabled={pca.isPending || activeColumns.length < 2}
            className="rounded-md bg-lumina-700 px-4 py-2 text-sm font-medium text-white hover:bg-lumina-800 disabled:opacity-60"
          >
            {pca.isPending ? "Running…" : "Run PCA"}
          </button>
        </div>

        {pca.isError ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {getErrorMessage(pca.error)}
          </p>
        ) : null}

        {pcaResult ? (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-slate-500">
              {pcaResult.n_observations} observations · {pcaResult.components} components retained
            </p>

            {/* Scree plot */}
            <div className="rounded border border-slate-200 p-2">
              <Plot
                data={[
                  {
                    x: pcaResult.explained_variance_ratio.map((_, i) => `PC${i + 1}`),
                    y: pcaResult.explained_variance_ratio.map((v) => v * 100),
                    type: "bar",
                    name: "Explained variance",
                    marker: { color: "#2563eb" },
                    hovertemplate: "%{x}: %{y:.1f}%<extra></extra>",
                  },
                  {
                    x: pcaResult.cumulative_variance.map((_, i) => `PC${i + 1}`),
                    y: pcaResult.cumulative_variance.map((v) => v * 100),
                    type: "scatter",
                    mode: "lines+markers",
                    name: "Cumulative",
                    yaxis: "y",
                    line: { color: "#dc2626", width: 1.5 },
                    marker: { color: "#dc2626", size: 5 },
                    hovertemplate: "%{x}: %{y:.1f}%<extra></extra>",
                  },
                ]}
                layout={{
                  autosize: true,
                  margin: { l: 48, r: 12, t: 8, b: 32 },
                  showlegend: true,
                  legend: { x: 0.6, y: 0.2, font: { size: 10 } },
                  xaxis: { title: { text: "Component", font: { size: 11 } } },
                  yaxis: { title: { text: "Variance (%)", font: { size: 11 } }, range: [0, 105] },
                }}
                useResizeHandler
                style={{ width: "100%", height: "220px" }}
                config={{ responsive: true, displayModeBar: false }}
              />
            </div>

            {/* Scores scatter PC1 vs PC2 */}
            {pcaResult.scores_pc2.length > 0 ? (
              <div className="rounded border border-slate-200 p-2">
                <Plot
                  data={[
                    {
                      x: pcaResult.scores_pc1,
                      y: pcaResult.scores_pc2,
                      type: "scatter",
                      mode: "markers",
                      marker: { color: "#2563eb", size: 4, opacity: 0.6 },
                      hovertemplate: "PC1: %{x:.3f}<br>PC2: %{y:.3f}<extra></extra>",
                      name: "Scores",
                    },
                  ]}
                  layout={{
                    autosize: true,
                    margin: { l: 48, r: 12, t: 8, b: 36 },
                    showlegend: false,
                    xaxis: { title: { text: "PC1", font: { size: 11 } }, zeroline: true },
                    yaxis: { title: { text: "PC2", font: { size: 11 } }, zeroline: true },
                  }}
                  useResizeHandler
                  style={{ width: "100%", height: "240px" }}
                  config={{ responsive: true, displayModeBar: false }}
                />
              </div>
            ) : null}

            {/* Loadings table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-1 pr-3 text-left font-semibold text-slate-700">Feature</th>
                    {pcaResult.explained_variance_ratio.map((_, i) => (
                      <th key={i} className="py-1 pr-3 text-right font-semibold text-slate-700">
                        PC{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pcaResult.loadings.map((row) => (
                    <tr key={row.feature} className="border-b border-slate-100">
                      <td className="py-1 pr-3 font-medium text-slate-800">{row.feature}</td>
                      {row.values.map((val, i) => (
                        <td key={i} className="py-1 pr-3 text-right tabular-nums text-slate-600">
                          {val.toFixed(3)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      {/* Clustering section */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">K-Means Clustering</h3>
            <p className="text-xs text-slate-500">Groups observations by similarity on a 2-PC projection.</p>
          </div>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-medium text-slate-800">Clusters (k)</span>
            <input
              type="number"
              aria-label="Number of clusters"
              min={2}
              max={12}
              value={nClusters}
              onChange={(event) => setNClusters(Math.min(12, Math.max(2, Number(event.target.value) || 2)))}
              className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={runClustering}
            disabled={clustering.isPending || activeColumns.length < 2}
            className="rounded-md bg-lumina-700 px-4 py-2 text-sm font-medium text-white hover:bg-lumina-800 disabled:opacity-60"
          >
            {clustering.isPending ? "Clustering…" : "Cluster"}
          </button>
        </div>

        {clustering.isError ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {getErrorMessage(clustering.error)}
          </p>
        ) : null}

        {clusterResult ? (
          <div className="mt-4 space-y-4">
            {/* Stats row */}
            <div className="flex flex-wrap gap-3">
              <div className="rounded-lg border border-lumina-200 bg-lumina-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-lumina-700">Inertia</p>
                <p className="text-lg font-bold text-slate-900">{clusterResult.inertia.toFixed(1)}</p>
              </div>
              {clusterResult.silhouette != null ? (
                <div className="rounded-lg border border-lumina-200 bg-lumina-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-lumina-700">Silhouette</p>
                  <p className="text-lg font-bold text-slate-900">{clusterResult.silhouette.toFixed(3)}</p>
                </div>
              ) : null}
              <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">
                <p className="font-medium text-slate-800">Cluster sizes</p>
                <p>{clusterResult.cluster_sizes.map((s, i) => `C${i + 1}: ${s}`).join(" · ")}</p>
              </div>
            </div>

            {/* Scatter colored by cluster */}
            <div className="rounded border border-slate-200 p-2">
              <Plot
                data={Array.from({ length: clusterResult.cluster_sizes.length }, (_, k) => {
                  const mask = clusterResult.labels.map((label) => label === k);
                  return {
                    x: clusterResult.x.filter((_, i) => mask[i]),
                    y: clusterResult.y.filter((_, i) => mask[i]),
                    type: "scatter" as const,
                    mode: "markers" as const,
                    name: `Cluster ${k + 1}`,
                    marker: { size: 4, opacity: 0.7 },
                    hovertemplate: `Cluster ${k + 1}<br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<extra></extra>`,
                  };
                })}
                layout={{
                  autosize: true,
                  margin: { l: 48, r: 12, t: 8, b: 36 },
                  showlegend: true,
                  legend: { font: { size: 10 } },
                  xaxis: { title: { text: "PC1", font: { size: 11 } }, zeroline: true },
                  yaxis: { title: { text: "PC2", font: { size: 11 } }, zeroline: true },
                }}
                useResizeHandler
                style={{ width: "100%", height: "260px" }}
                config={{ responsive: true, displayModeBar: false }}
              />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
