import { useEffect, useMemo, useState } from "react";
import type { DataValidationWarning, RegressionMissingStrategy, RegressionModelType } from "@/types/regression";

interface ModelConfigPanelProps {
  columns: string[];
  modelType: RegressionModelType;
  dependent: string | null;
  independents: string[];
  interactionTerms: string[][];
  trainTestSplit: number;
  missingStrategy: RegressionMissingStrategy;
  alpha: number;
  l1Ratio: number;
  polynomialDegree: number;
  maxDepth: number | null;
  nEstimators: number;
  learningRate: number;
  cvEnabled: boolean;
  cvFolds: number;
  validationWarnings: DataValidationWarning[];
  isBusy: boolean;
  onModelTypeChange: (value: RegressionModelType) => void;
  onDependentChange: (value: string | null) => void;
  onIndependentToggle: (column: string, checked: boolean) => void;
  onInteractionTermsChange: (terms: string[][]) => void;
  onTrainTestSplitChange: (value: number) => void;
  onMissingStrategyChange: (value: RegressionMissingStrategy) => void;
  onAlphaChange: (value: number) => void;
  onL1RatioChange: (value: number) => void;
  onPolynomialDegreeChange: (value: number) => void;
  onMaxDepthChange: (value: number | null) => void;
  onNEstimatorsChange: (value: number) => void;
  onLearningRateChange: (value: number) => void;
  onCvEnabledChange: (value: boolean) => void;
  onCvFoldsChange: (value: number) => void;
  onDismissWarning: (index: number) => void;
  onFit: () => void;
}

const MODEL_OPTIONS: Array<{ value: RegressionModelType; label: string }> = [
  { value: "ols", label: "OLS" },
  { value: "logistic", label: "Logistic" },
  { value: "ridge", label: "Ridge" },
  { value: "lasso", label: "Lasso" },
  { value: "elastic_net", label: "ElasticNet" },
  { value: "decision_tree", label: "Decision Tree" },
  { value: "random_forest", label: "Random Forest" },
  { value: "decision_tree_classifier", label: "DT Classifier" },
  { value: "random_forest_classifier", label: "RF Classifier" },
  { value: "gradient_boosting", label: "Gradient Boost" },
  { value: "gradient_boosting_classifier", label: "GB Classifier" },
];

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
  interactionTerms,
  trainTestSplit,
  missingStrategy,
  alpha,
  l1Ratio,
  polynomialDegree,
  maxDepth,
  nEstimators,
  learningRate,
  cvEnabled,
  cvFolds,
  validationWarnings,
  isBusy,
  onModelTypeChange,
  onDependentChange,
  onIndependentToggle,
  onInteractionTermsChange,
  onTrainTestSplitChange,
  onMissingStrategyChange,
  onAlphaChange,
  onL1RatioChange,
  onPolynomialDegreeChange,
  onMaxDepthChange,
  onNEstimatorsChange,
  onLearningRateChange,
  onCvEnabledChange,
  onCvFoldsChange,
  onDismissWarning,
  onFit,
}: ModelConfigPanelProps) {
  const independentCandidates = columns.filter((column) => column !== dependent);
  const selectedInteractionCandidates = useMemo(
    () => independentCandidates.filter((column) => independents.includes(column)),
    [independentCandidates, independents],
  );
  const [interactionLeft, setInteractionLeft] = useState("");
  const [interactionRight, setInteractionRight] = useState("");

  useEffect(() => {
    const firstOption = selectedInteractionCandidates[0] ?? "";
    const secondOption = selectedInteractionCandidates.find((column) => column !== firstOption) ?? "";

    setInteractionLeft((current) =>
      current && selectedInteractionCandidates.includes(current) ? current : firstOption,
    );
    setInteractionRight((current) =>
      current && current !== firstOption && selectedInteractionCandidates.includes(current) ? current : secondOption,
    );
  }, [selectedInteractionCandidates]);

  const normalizedCandidate = useMemo(() => {
    if (!interactionLeft || !interactionRight || interactionLeft === interactionRight) {
      return null;
    }

    return [interactionLeft, interactionRight].sort((left, right) => left.localeCompare(right));
  }, [interactionLeft, interactionRight]);

  const canAddInteraction =
    normalizedCandidate !== null &&
    !interactionTerms.some(
      (term) =>
        term.length === 2 && term[0] === normalizedCandidate[0] && term[1] === normalizedCandidate[1],
    );
  const canFit = Boolean(dependent && independents.length > 0 && !isBusy);
  const isRegularizedModel = modelType === "ridge" || modelType === "lasso" || modelType === "elastic_net";
  const isElasticNetModel = modelType === "elastic_net";
  const isTreeModel =
    modelType === "decision_tree" ||
    modelType === "random_forest" ||
    modelType === "decision_tree_classifier" ||
    modelType === "random_forest_classifier";
  const isRandomForestModel = modelType === "random_forest" || modelType === "random_forest_classifier";
  const isGradientBoostingModel = modelType === "gradient_boosting" || modelType === "gradient_boosting_classifier";
  const isEnsembleModel = isRandomForestModel || isGradientBoostingModel;
  const isClassifierModel =
    modelType === "logistic" ||
    modelType === "decision_tree_classifier" ||
    modelType === "random_forest_classifier" ||
    modelType === "gradient_boosting_classifier";
  const supportsPolynomialDegree = !isClassifierModel && !isTreeModel && !isGradientBoostingModel;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-800">Regression Configuration</h2>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Model Type</p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {MODEL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onModelTypeChange(option.value)}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  modelType === option.value
                    ? "border-lumina-600 bg-lumina-50 text-lumina-700"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
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

        <div className="space-y-3 rounded-md border border-slate-200 p-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Interaction Terms</p>
            <p className="mt-1 text-xs text-slate-500">
              Add pairwise interactions between selected independent variables.
            </p>
          </div>

          {selectedInteractionCandidates.length < 2 ? (
            <p className="text-xs text-slate-500">Select at least two independent variables to define an interaction.</p>
          ) : (
            <>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="interaction-left">
                Interaction term A
              </label>
              <select
                id="interaction-left"
                aria-label="Interaction term A"
                value={interactionLeft}
                onChange={(event) => setInteractionLeft(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-lumina-500 focus:outline-none"
              >
                {selectedInteractionCandidates.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>

              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="interaction-right">
                Interaction term B
              </label>
              <select
                id="interaction-right"
                aria-label="Interaction term B"
                value={interactionRight}
                onChange={(event) => setInteractionRight(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-lumina-500 focus:outline-none"
              >
                {selectedInteractionCandidates
                  .filter((column) => column !== interactionLeft)
                  .map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  if (!normalizedCandidate) {
                    return;
                  }

                  onInteractionTermsChange([...interactionTerms, normalizedCandidate]);
                }}
                disabled={!canAddInteraction}
                className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add Interaction Term
              </button>
            </>
          )}

          {interactionTerms.length > 0 ? (
            <div className="space-y-2">
              {interactionTerms.map((term, index) => (
                <div
                  key={`${term[0]}-${term[1]}`}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                >
                  <span>{`${term[0]} × ${term[1]}`}</span>
                  <button
                    type="button"
                    onClick={() => onInteractionTermsChange(interactionTerms.filter((_, termIndex) => termIndex !== index))}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
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

        <div className="space-y-2 rounded-md border border-slate-200 p-3">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <input
              type="checkbox"
              checked={cvEnabled}
              onChange={(event) => onCvEnabledChange(event.target.checked)}
            />
            Cross-Validation
          </label>
          {cvEnabled ? (
            <div>
              <label htmlFor="cv-folds" className="block text-xs text-slate-600">
                Number of folds (k)
              </label>
              <input
                id="cv-folds"
                aria-label="Number of folds (k)"
                type="number"
                min={2}
                max={20}
                value={cvFolds}
                onChange={(event) => onCvFoldsChange(Number(event.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-lumina-500 focus:outline-none"
              />
            </div>
          ) : null}
        </div>

        {isTreeModel || isGradientBoostingModel ? (
          <div className="space-y-3 rounded-md border border-slate-200 p-3">
            <div>
              <label htmlFor="max-depth-input" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Max Depth
              </label>
              <input
                id="max-depth-input"
                aria-label="Max Depth"
                type="number"
                min={1}
                step={1}
                value={maxDepth ?? ""}
                placeholder="Unlimited"
                onChange={(event) => {
                  const value = event.target.value;
                  onMaxDepthChange(value === "" ? null : Number(value));
                }}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-lumina-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">Leave blank for unlimited depth.</p>
            </div>

            {isEnsembleModel ? (
              <div>
                <label htmlFor="n-estimators-input" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Number of Trees
                </label>
                <input
                  id="n-estimators-input"
                  aria-label="Number of Trees"
                  type="number"
                  min={1}
                  step={1}
                  value={nEstimators}
                  onChange={(event) => onNEstimatorsChange(Number(event.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-lumina-500 focus:outline-none"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {isGradientBoostingModel ? (
          <div className="space-y-2 rounded-md border border-slate-200 p-3">
            <label htmlFor="learning-rate-input" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Learning Rate
            </label>
            <div className="flex items-center gap-3">
              <input
                aria-label="Learning Rate slider"
                type="range"
                min={0.01}
                max={1}
                step={0.01}
                value={learningRate}
                onChange={(event) => onLearningRateChange(Number(event.target.value))}
                className="flex-1"
              />
              <input
                id="learning-rate-input"
                aria-label="Learning Rate"
                type="number"
                min={0.01}
                max={1}
                step={0.01}
                value={learningRate}
                onChange={(event) => onLearningRateChange(Number(event.target.value))}
                className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-lumina-500 focus:outline-none"
              />
            </div>
          </div>
        ) : null}

        {isRegularizedModel ? (
          <div className="space-y-2 rounded-md border border-slate-200 p-3">
            <label htmlFor="alpha-input" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Alpha
            </label>
            <div className="flex items-center gap-3">
              <input
                aria-label="Alpha slider"
                type="range"
                min={0.01}
                max={5}
                step={0.01}
                value={alpha}
                onChange={(event) => onAlphaChange(Number(event.target.value))}
                className="flex-1"
              />
              <input
                id="alpha-input"
                aria-label="Alpha"
                type="number"
                min={0.01}
                max={5}
                step={0.01}
                value={alpha}
                onChange={(event) => onAlphaChange(Number(event.target.value))}
                className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-lumina-500 focus:outline-none"
              />
            </div>
          </div>
        ) : null}

        {isElasticNetModel ? (
          <div className="space-y-2 rounded-md border border-slate-200 p-3">
            <label htmlFor="l1-ratio-input" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              L1 Ratio
            </label>
            <div className="flex items-center gap-3">
              <input
                aria-label="L1 Ratio slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={l1Ratio}
                onChange={(event) => onL1RatioChange(Number(event.target.value))}
                className="flex-1"
              />
              <input
                id="l1-ratio-input"
                aria-label="L1 Ratio"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={l1Ratio}
                onChange={(event) => onL1RatioChange(Number(event.target.value))}
                className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-lumina-500 focus:outline-none"
              />
            </div>
          </div>
        ) : null}

        {supportsPolynomialDegree ? (
          <div>
            <label htmlFor="polynomial-degree" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Polynomial Degree
            </label>
            <input
              id="polynomial-degree"
              aria-label="Polynomial Degree"
              type="number"
              min={1}
              max={5}
              step={1}
              value={polynomialDegree}
              onChange={(event) => onPolynomialDegreeChange(Number(event.target.value))}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-lumina-500 focus:outline-none"
            />
          </div>
        ) : null}

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

        {validationWarnings.length > 0 ? (
          <div className="space-y-2">
            {validationWarnings.map((warning, index) => (
              <div
                key={`${warning.column}-${warning.warning_type}-${index}`}
                className={`flex items-start justify-between rounded-md border px-3 py-2 text-xs ${
                  warning.severity === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-blue-200 bg-blue-50 text-blue-800"
                }`}
              >
                <span>{warning.message}</span>
                <button
                  type="button"
                  onClick={() => onDismissWarning(index)}
                  className="ml-2 text-sm font-bold leading-none opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

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
