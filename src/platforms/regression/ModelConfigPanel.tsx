interface ModelConfigPanelProps {
  columns: string[];
  modelType: "ols" | "logistic";
  dependent: string | null;
  independents: string[];
  trainTestSplit: number;
  missingStrategy: "listwise" | "mean_imputation";
  isBusy: boolean;
  onModelTypeChange: (value: "ols" | "logistic") => void;
  onDependentChange: (value: string | null) => void;
  onIndependentToggle: (column: string, checked: boolean) => void;
  onTrainTestSplitChange: (value: number) => void;
  onMissingStrategyChange: (value: "listwise" | "mean_imputation") => void;
  onFit: () => void;
}

function getSplitLabel(value: number): string {
  const trainPct = Math.round(value * 100);
  const testPct = 100 - trainPct;

  if (value >= 1) {
    return "100% Training";
  }

  return `${trainPct}/${testPct} Split`;
}

export function ModelConfigPanel({
  columns,
  modelType,
  dependent,
  independents,
  trainTestSplit,
  missingStrategy,
  isBusy,
  onModelTypeChange,
  onDependentChange,
  onIndependentToggle,
  onTrainTestSplitChange,
  onMissingStrategyChange,
  onFit,
}: ModelConfigPanelProps) {
  const independentCandidates = columns.filter((column) => column !== dependent);
  const canFit = Boolean(dependent && independents.length > 0 && !isBusy);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-800">Regression Configuration</h2>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Model Type</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onModelTypeChange("ols")}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                modelType === "ols"
                  ? "border-lumina-600 bg-lumina-50 text-lumina-700"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              OLS
            </button>
            <button
              type="button"
              onClick={() => onModelTypeChange("logistic")}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                modelType === "logistic"
                  ? "border-lumina-600 bg-lumina-50 text-lumina-700"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Logistic
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="dependent-variable" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Dependent Variable
          </label>
          <select
            id="dependent-variable"
            value={dependent ?? ""}
            onChange={(event) => onDependentChange(event.target.value || null)}
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-lumina-500 focus:outline-none"
          >
            <option value="">Select dependent variable</option>
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Independent Variables</p>
          <div className="max-h-48 space-y-2 overflow-auto rounded-md border border-slate-200 p-2">
            {independentCandidates.length === 0 ? (
              <p className="text-xs text-slate-500">Select a dependent variable first.</p>
            ) : (
              independentCandidates.map((column) => {
                const checked = independents.includes(column);

                return (
                  <label key={column} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => onIndependentToggle(column, event.target.checked)}
                    />
                    {column}
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div>
          <label htmlFor="train-test-split" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Train/Test Split ({getSplitLabel(trainTestSplit)})
          </label>
          <input
            id="train-test-split"
            type="range"
            min={0.5}
            max={1}
            step={0.05}
            value={trainTestSplit}
            onChange={(event) => onTrainTestSplitChange(Number(event.target.value))}
            className="w-full"
          />
        </div>

        <fieldset>
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Missing Value Strategy</legend>
          <div className="space-y-2 rounded-md border border-slate-200 p-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="missing-strategy"
                value="listwise"
                checked={missingStrategy === "listwise"}
                onChange={() => onMissingStrategyChange("listwise")}
              />
              Listwise Deletion
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="missing-strategy"
                value="mean_imputation"
                checked={missingStrategy === "mean_imputation"}
                onChange={() => onMissingStrategyChange("mean_imputation")}
              />
              Mean Imputation
            </label>
          </div>
        </fieldset>

        <button
          type="button"
          onClick={onFit}
          disabled={!canFit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-lumina-700 px-3 py-2 text-sm font-medium text-white hover:bg-lumina-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-white" /> : null}
          Fit Model
        </button>
      </div>
    </section>
  );
}
