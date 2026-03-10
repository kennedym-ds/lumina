import type { MissingValueReport } from "@/types/regression";

interface MissingValueDialogProps {
  report: MissingValueReport;
  onSelectStrategy: (strategy: "listwise" | "mean_imputation") => void;
}

export function MissingValueDialog({ report, onSelectStrategy }: MissingValueDialogProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-xl">
        <h3 className="text-base font-semibold text-slate-800">Missing values detected</h3>
        <p className="mt-1 text-sm text-slate-600">
          {report.total_rows_affected.toLocaleString()} rows are affected by missing values in selected variables.
        </p>

        <div className="mt-3 overflow-auto rounded border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-700">
              <tr>
                <th className="px-2 py-2 font-semibold">Column</th>
                <th className="px-2 py-2 font-semibold">Missing Count</th>
                <th className="px-2 py-2 font-semibold">Missing %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {report.columns_with_missing.map((column) => (
                <tr key={column.name}>
                  <td className="px-2 py-2">{column.name}</td>
                  <td className="px-2 py-2">{column.count.toLocaleString()}</td>
                  <td className="px-2 py-2">{column.pct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 rounded bg-slate-50 p-2 text-sm text-slate-700">{report.recommendation}</p>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onSelectStrategy("listwise")}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Use Listwise Deletion
          </button>
          <button
            type="button"
            onClick={() => onSelectStrategy("mean_imputation")}
            className="rounded-md bg-lumina-700 px-3 py-2 text-sm font-medium text-white hover:bg-lumina-800"
          >
            Use Mean Imputation
          </button>
        </div>
      </div>
    </div>
  );
}
