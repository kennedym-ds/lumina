import type { CrossValidationResponse, RegressionResponse } from "@/types/regression";

const CLASSIFIER_MODEL_TYPES = new Set([
  "logistic",
  "decision_tree_classifier",
  "random_forest_classifier",
  "gradient_boosting_classifier",
]);

interface ResultsSummaryProps {
  result: RegressionResponse;
  cvResult?: CrossValidationResponse | null;
}

function formatMetric(value: number | null | undefined, digits = 3): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function pValueClass(pValue: number | null): string {
  if (pValue == null) {
    return "text-slate-600 bg-slate-100";
  }

  if (pValue <= 0.05) {
    return "text-emerald-700 bg-emerald-50";
  }

  if (pValue <= 0.1) {
    return "text-amber-700 bg-amber-50";
  }

  return "text-red-700 bg-red-50";
}

export function ResultsSummary({ result, cvResult }: ResultsSummaryProps) {
  const isClassifierModel = CLASSIFIER_MODEL_TYPES.has(result.model_type);
  const statLabel = result.model_type === "logistic" ? "z-stat" : result.model_type === "ols" ? "t-stat" : "stat";
  const hasFeatureImportances = Boolean(result.feature_importances && result.feature_importances.length > 0);
  const classifierAccuracy = result.accuracy ?? null;
  const classifierF1 = result.f1 ?? null;

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-800">Model Summary</h2>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-8">
        <div className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
          <p className="font-semibold text-slate-600">{isClassifierModel ? "Accuracy" : "R²"}</p>
          <p>{isClassifierModel ? formatMetric(classifierAccuracy) : formatMetric(result.r_squared)}</p>
        </div>
        {isClassifierModel ? (
          <div className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
            <p className="font-semibold text-slate-600">F1</p>
            <p>{formatMetric(classifierF1)}</p>
          </div>
        ) : null}
        <div className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
          <p className="font-semibold text-slate-600">AIC</p>
          <p>{formatMetric(result.aic)}</p>
        </div>
        <div className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
          <p className="font-semibold text-slate-600">BIC</p>
          <p>{formatMetric(result.bic)}</p>
        </div>
        <div className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
          <p className="font-semibold text-slate-600">RMSE</p>
          <p>{formatMetric(result.rmse)}</p>
        </div>
        <div className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
          <p className="font-semibold text-slate-600">MAE</p>
          <p>{formatMetric(result.mae)}</p>
        </div>
        <div className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
          <p className="font-semibold text-slate-600">N observations</p>
          <p>{result.n_observations.toLocaleString()}</p>
        </div>
        <div className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
          <p className="font-semibold text-slate-600">N train</p>
          <p>{result.n_train == null ? "—" : result.n_train.toLocaleString()}</p>
        </div>
        <div className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
          <p className="font-semibold text-slate-600">N test</p>
          <p>{result.n_test == null ? "—" : result.n_test.toLocaleString()}</p>
        </div>
      </div>

      {cvResult ? (
        <div className="rounded-md border border-slate-200 p-3">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Cross-Validation ({cvResult.k}-fold, {cvResult.scoring})</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
              <p className="font-semibold text-slate-600">Mean Score</p>
              <p>{formatMetric(cvResult.mean_score)}</p>
            </div>
            <div className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
              <p className="font-semibold text-slate-600">Std Dev</p>
              <p>{formatMetric(cvResult.std_score)}</p>
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xs text-slate-500">
              Fold scores: {cvResult.fold_scores.map((score) => formatMetric(score)).join(", ")}
            </p>
          </div>
        </div>
      ) : null}

      {hasFeatureImportances ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Feature Importances</h3>
          <div className="space-y-3 rounded border border-slate-200 p-3">
            {result.feature_importances?.map((row) => (
              <div key={row.feature} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-700">
                  <span className="font-medium text-slate-800">{row.feature}</span>
                  <span>{formatMetric(row.importance, 4)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-lumina-600"
                    style={{ width: `${Math.max(row.importance * 100, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Coefficients</h3>
          <div className="overflow-auto rounded border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-left text-slate-700">
                <tr>
                  <th className="px-2 py-2 font-semibold">Variable</th>
                  <th className="px-2 py-2 font-semibold">Coefficient</th>
                  <th className="px-2 py-2 font-semibold">SE</th>
                  <th className="px-2 py-2 font-semibold">{statLabel}</th>
                  <th className="px-2 py-2 font-semibold">p-value</th>
                  <th className="px-2 py-2 font-semibold">95% CI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {result.coefficients.map((row) => (
                  <tr key={row.variable}>
                    <td className={`px-2 py-2 text-slate-800 ${row.variable === "const" ? "italic" : ""}`}>{row.variable}</td>
                    <td className="px-2 py-2 text-slate-700">{formatMetric(row.coefficient)}</td>
                    <td className="px-2 py-2 text-slate-700">{formatMetric(row.std_error)}</td>
                    <td className="px-2 py-2 text-slate-700">
                      {formatMetric(result.model_type === "logistic" ? row.z_stat : row.t_stat)}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`rounded px-2 py-0.5 ${pValueClass(row.p_value)}`}>{formatMetric(row.p_value)}</span>
                    </td>
                    <td className="px-2 py-2 text-slate-700">[{formatMetric(row.ci_lower)}, {formatMetric(row.ci_upper)}]</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
