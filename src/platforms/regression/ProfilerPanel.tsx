import { useEffect, useMemo, useRef, useState } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import type * as PlotlyTypes from "plotly.js";
import { ApiError } from "@/api/client";
import { useProfiler } from "@/api/model";
import type { ProfilerResponse, ProfileTrace } from "@/types/regression";

const Plot = createPlotlyComponent(Plotly);

const DEBOUNCE_MS = 120;
const GRID_POINTS = 25;

interface ProfilerPanelProps {
  datasetId: string;
  dependent: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.userMessage ?? error.detail ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to compute the profiler. Please refit the model and try again.";
}

function formatValue(value: number, digits = 4): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function traceFigure(
  trace: ProfileTrace,
  predicted: number,
  responseLabel: string,
): { data: PlotlyTypes.Data[]; layout: Partial<PlotlyTypes.Layout> } {
  const layout: Partial<PlotlyTypes.Layout> = {
    autosize: true,
    margin: { l: 44, r: 8, t: 6, b: 28 },
    showlegend: false,
    xaxis: { title: { text: trace.feature, font: { size: 11 } }, automargin: true },
    yaxis: { title: { text: responseLabel, font: { size: 11 } }, automargin: true },
    hovermode: "closest",
  };

  if (trace.is_numeric) {
    const currentX = typeof trace.current === "number" ? trace.current : Number(trace.current);
    return {
      data: [
        {
          x: trace.grid_x as number[],
          y: trace.grid_y,
          type: "scatter",
          mode: "lines",
          line: { color: "#2563eb", width: 2 },
          hovertemplate: `${trace.feature}: %{x:.4g}<br>${responseLabel}: %{y:.4g}<extra></extra>`,
        },
        {
          x: [currentX],
          y: [predicted],
          type: "scatter",
          mode: "markers",
          marker: { color: "#dc2626", size: 9 },
          hoverinfo: "skip",
        },
      ],
      layout: {
        ...layout,
        shapes: [
          {
            type: "line",
            x0: currentX,
            x1: currentX,
            yref: "paper",
            y0: 0,
            y1: 1,
            line: { color: "#dc2626", width: 1, dash: "dash" },
          },
          {
            type: "line",
            xref: "paper",
            x0: 0,
            x1: 1,
            y0: predicted,
            y1: predicted,
            line: { color: "#dc2626", width: 1, dash: "dash" },
          },
        ],
      },
    };
  }

  const categories = trace.grid_x as string[];
  const colors = categories.map((category) =>
    String(category) === String(trace.current) ? "#dc2626" : "#93c5fd",
  );
  return {
    data: [
      {
        x: categories,
        y: trace.grid_y,
        type: "bar",
        marker: { color: colors },
        hovertemplate: `${trace.feature}: %{x}<br>${responseLabel}: %{y:.4g}<extra></extra>`,
      },
    ],
    layout,
  };
}

export function ProfilerPanel({ datasetId, dependent }: ProfilerPanelProps) {
  const profilerMutation = useProfiler(datasetId);
  const [values, setValues] = useState<Record<string, number | string>>({});
  const [targetClass, setTargetClass] = useState<string | null>(null);
  const [data, setData] = useState<ProfilerResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sequence number of the most recent request; responses from older requests are
  // ignored so debounced slider/class changes can't resolve out of order and snap
  // the UI back to stale profiler data.
  const latestRequestIdRef = useRef(0);

  const runProfiler = async (
    nextValues: Record<string, number | string>,
    nextTarget: string | null,
    adoptValues = false,
  ) => {
    const requestId = ++latestRequestIdRef.current;
    try {
      const response = await profilerMutation.mutateAsync({
        values: nextValues,
        target_class: nextTarget,
        grid_points: GRID_POINTS,
      });
      if (requestId !== latestRequestIdRef.current) return;
      setData(response);
      setTargetClass(response.target_class);
      // Only adopt server-resolved factor settings on first load. For slider-driven
      // calls the local values are authoritative — adopting a late response here would
      // snap the slider back to a stale position mid-drag.
      if (adoptValues) {
        setValues(response.current_values);
      }
      setErrorMessage(null);
    } catch (error) {
      if (requestId !== latestRequestIdRef.current) return;
      setErrorMessage(getErrorMessage(error));
    }
  };

  // Compute defaults once on mount. The parent remounts this panel (keyed on the
  // fitted model id) whenever a new model is fit, so an empty-deps effect is safe.
  useEffect(() => {
    void runProfiler({}, null, true);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleRun = (nextValues: Record<string, number | string>) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void runProfiler(nextValues, targetClass);
    }, DEBOUNCE_MS);
  };

  const handleFactorChange = (feature: string, isNumeric: boolean, raw: string) => {
    const nextValue: number | string = isNumeric ? Number(raw) : raw;
    const nextValues = { ...values, [feature]: nextValue };
    setValues(nextValues);
    scheduleRun(nextValues);
  };

  const handleTargetChange = (nextTarget: string) => {
    setTargetClass(nextTarget);
    void runProfiler(values, nextTarget);
  };

  const responseLabel = useMemo(
    () => (data?.response_kind === "probability" ? `P(${data.target_class ?? "class"})` : dependent),
    [data?.response_kind, data?.target_class, dependent],
  );

  if (!data) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-500">
        {errorMessage ?? "Building profiler…"}
      </div>
    );
  }

  const isProbability = data.response_kind === "probability";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Prediction Profiler</h3>
          <p className="mt-1 text-sm text-slate-500">
            Drag a factor to hold the others fixed and watch {isProbability ? "the class probability" : dependent}{" "}
            respond live.
          </p>
        </div>
        <div className="flex items-end gap-3">
          {isProbability && data.class_labels && data.class_labels.length > 1 ? (
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span>Class</span>
              <select
                aria-label="Profiled class"
                value={data.target_class ?? ""}
                onChange={(event) => handleTargetChange(event.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                {data.class_labels.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="rounded-lg border border-lumina-200 bg-lumina-50 px-4 py-2 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-lumina-700">{responseLabel}</p>
            <p className="text-2xl font-bold text-slate-900">
              {isProbability
                ? `${formatValue(data.predicted_value * 100, 2)}%`
                : formatValue(data.predicted_value, 6)}
            </p>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.profiles.map((trace) => {
          const figure = traceFigure(trace, data.predicted_value, responseLabel);
          const currentValue = values[trace.feature] ?? trace.current;

          return (
            <div key={trace.feature} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-800">{trace.feature}</span>
                <span className="text-xs text-slate-500">
                  {trace.is_numeric ? formatValue(Number(currentValue), 4) : String(currentValue)}
                </span>
              </div>

              <Plot
                data={figure.data}
                layout={{ ...figure.layout, autosize: true }}
                useResizeHandler
                style={{ width: "100%", height: "180px" }}
                config={{ responsive: true, displayModeBar: false }}
              />

              {trace.is_numeric && trace.min != null && trace.max != null ? (
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    aria-label={`${trace.feature} slider`}
                    min={trace.min}
                    max={trace.max}
                    step={(trace.max - trace.min) / 100 || 0.01}
                    value={Number(currentValue)}
                    onChange={(event) => handleFactorChange(trace.feature, true, event.target.value)}
                    className="h-1.5 flex-1 cursor-pointer accent-lumina-600"
                  />
                  <input
                    type="number"
                    aria-label={`${trace.feature} value`}
                    value={Number(currentValue)}
                    min={trace.min}
                    max={trace.max}
                    onChange={(event) => handleFactorChange(trace.feature, true, event.target.value)}
                    className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
              ) : (
                <select
                  aria-label={`${trace.feature} value`}
                  value={String(currentValue)}
                  onChange={(event) => handleFactorChange(trace.feature, false, event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {(trace.categories ?? []).map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
