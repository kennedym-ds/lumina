import type { RegressionResponse } from "@/types/regression";

interface ResultsSummaryProps {
  result: RegressionResponse;
  logisticAccuracy?: number | null;
}

function formatMetric(value: number | null | undefined, digits = 3): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function pValueClass(pValue: number): string {
  if (pValue <= 0.05) {
    return "text-emerald-700 bg-emerald-50";
  }

  if (pValue <= 0.1) {
    return "text-amber-700 bg-amber-50";
  }

  return "text-red-700 bg-red-50";
}

export function ResultsSummary({ result, logisticAccuracy }: ResultsSummaryProps) {
  const statLabel = result.model_type === "logistic" ? "z-stat" : "t-stat";

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-800">Model Summary</h2>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
          <p className="font-semibold text-slate-600">{result.model_type === "logistic" ? "Accuracy" : "R²"}</p>
          <p>{result.model_type === "logistic" ? formatMetric(logisticAccuracy) : formatMetric(result.r_squared)}</p>
        </div>
        <div className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
          <p className="font-semibold text-slate-600">AIC</p>
          <p>{formatMetric(result.aic)}</p>
        </div>
        <div className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
          <p className="font-semibold text-slate-600">BIC</p>
          <p>{formatMetric(result.bic)}</p>
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
    </section>
  );
}
