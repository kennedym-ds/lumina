import { useMemo, useState } from "react";
import { ApiError } from "@/api/client";
import { usePredict } from "@/api/model";
import { useDatasetStore } from "@/stores/datasetStore";

const CLASSIFIER_MODEL_TYPES = new Set([
  "logistic",
  "decision_tree_classifier",
  "random_forest_classifier",
  "gradient_boosting_classifier",
]);

interface PredictionPanelProps {
  independents: string[];
  modelType: string;
  datasetId: string;
}

function formatMetric(value: number, digits = 4): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.userMessage ?? error.detail ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Prediction failed. Please review the input values and try again.";
}

export function PredictionPanel({ independents, modelType, datasetId }: PredictionPanelProps) {
  const columns = useDatasetStore((state) => state.columns);
  const predictMutation = usePredict(datasetId);
  const [values, setValues] = useState<Record<string, string>>({});

  const fieldMetadata = useMemo(
    () =>
      independents.map((name) => ({
        name,
        column: columns.find((column) => column.name === name),
      })),
    [columns, independents],
  );
  const isClassifierModel = CLASSIFIER_MODEL_TYPES.has(modelType);

  const canSubmit = independents.length > 0 && independents.every((name) => (values[name] ?? "").trim().length > 0);

  const handlePredict = async () => {
    const payloadValues = Object.fromEntries(
      fieldMetadata.map(({ name, column }) => {
        const rawValue = values[name] ?? "";
        const isNumeric = column?.dtype === "numeric";
        if (isNumeric) {
          const numericValue = Number(rawValue);
          return [name, Number.isFinite(numericValue) ? numericValue : rawValue];
        }

        return [name, rawValue];
      }),
    );

    await predictMutation.mutateAsync({ values: payloadValues });
  };

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Prediction</h3>
        <p className="mt-1 text-sm text-slate-500">Enter values for the selected independent variables to score a new observation.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {fieldMetadata.map(({ name, column }) => {
          const isNumeric = column?.dtype === "numeric";

          return (
            <label key={name} className="space-y-1 text-sm text-slate-700">
              <span className="font-medium text-slate-800">{name}</span>
              <input
                type={isNumeric ? "number" : "text"}
                inputMode={isNumeric ? "decimal" : undefined}
                value={values[name] ?? ""}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setValues((current) => ({ ...current, [name]: nextValue }));
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-lumina-500 focus:outline-none"
                placeholder={isNumeric ? "Enter a number" : "Enter a value"}
              />
            </label>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            void handlePredict();
          }}
          disabled={!canSubmit || predictMutation.isPending}
          className="inline-flex items-center justify-center rounded-md bg-lumina-700 px-4 py-2 text-sm font-medium text-white hover:bg-lumina-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {predictMutation.isPending ? "Predicting..." : "Predict"}
        </button>

        {!canSubmit ? <p className="text-xs text-slate-500">Fill in every predictor value to run a prediction.</p> : null}
      </div>

      {predictMutation.isError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {getErrorMessage(predictMutation.error)}
        </div>
      ) : null}

      {predictMutation.data ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,280px)_1fr]">
          <div className="rounded-lg border border-lumina-200 bg-lumina-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-lumina-700">Predicted Value</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatMetric(predictMutation.data.predicted_value, 6)}</p>
            {predictMutation.data.prediction_interval ? (
              <p className="mt-2 text-sm text-slate-600">
                95% prediction interval: [{formatMetric(predictMutation.data.prediction_interval[0])},{" "}
                {formatMetric(predictMutation.data.prediction_interval[1])}]
              </p>
            ) : null}
          </div>

          {isClassifierModel && predictMutation.data.probabilities ? (
            <div className="rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-800">Class Probabilities</h4>
              <div className="mt-3 space-y-3">
                {Object.entries(predictMutation.data.probabilities).map(([label, probability]) => (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm text-slate-700">
                      <span className="font-medium text-slate-800">{label}</span>
                      <span>{formatMetric(probability, 4)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-lumina-600" style={{ width: `${Math.max(probability * 100, 3)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}