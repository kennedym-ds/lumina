import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/api/client";
import {
  useCheckMissing,
  useConfusionMatrix,
  useCrossValidation,
  useDataValidation,
  useDiagnostics,
  useFitRegression,
  useModelComparison,
  useRoc,
  useVIF,
  useStepwiseSelection,
  useBayesianRegression,
} from "@/api/model";
import { ErrorToast } from "@/components/Toolbar/ErrorToast";
import { useDatasetStore } from "@/stores/datasetStore";
import { useRegressionStore } from "@/stores/regressionStore";
import type {
  BayesianRegressionResponse,
  CrossValidationRequest,
  ModelComparisonEntry,
  RegressionRequest,
  StepwiseSelectionResponse,
} from "@/types/regression";
import { ConfusionMatrix } from "./ConfusionMatrix";
import { DiagnosticPlots } from "./DiagnosticPlots";
import { ExtendedDiagnostics } from "./ExtendedDiagnostics";
import { MissingValueDialog } from "./MissingValueDialog";
import { ModelConfigPanel } from "./ModelConfigPanel";
import { PredictionPanel } from "./PredictionPanel";
import { ResultsSummary } from "./ResultsSummary";
import { RocCurve } from "./RocCurve";

type InsightTab = "prediction" | "diagnostics";

const CLASSIFIER_MODEL_TYPES = new Set([
  "logistic",
  "decision_tree_classifier",
  "random_forest_classifier",
  "gradient_boosting_classifier",
]);

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 422) {
      return error.userMessage ?? error.detail ?? "The model could not be fit with the selected variables.";
    }

    return error.userMessage ?? error.detail ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to fit model. Please review your settings and try again.";
}

function formatComparisonMetric(value: number | null | undefined, digits = 3): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function getComparisonPrimaryMetric(model: ModelComparisonEntry): { label: string; value: number | null } {
  if (model.accuracy != null) {
    return { label: "Accuracy", value: model.accuracy };
  }

  return { label: "R²", value: model.r_squared };
}

export function RegressionPlatform() {
  const queryClient = useQueryClient();
  const datasetId = useDatasetStore((state) => state.datasetId);
  const columns = useDatasetStore((state) => state.columns);

  const modelType = useRegressionStore((state) => state.modelType);
  const dependent = useRegressionStore((state) => state.dependent);
  const independents = useRegressionStore((state) => state.independents);
  const interactionTerms = useRegressionStore((state) => state.interactionTerms);
  const trainTestSplit = useRegressionStore((state) => state.trainTestSplit);
  const missingStrategy = useRegressionStore((state) => state.missingStrategy);
  const alpha = useRegressionStore((state) => state.alpha);
  const l1Ratio = useRegressionStore((state) => state.l1Ratio);
  const polynomialDegree = useRegressionStore((state) => state.polynomialDegree);
  const maxDepth = useRegressionStore((state) => state.maxDepth);
  const nEstimators = useRegressionStore((state) => state.nEstimators);
  const learningRate = useRegressionStore((state) => state.learningRate);
  const cvEnabled = useRegressionStore((state) => state.cvEnabled);
  const cvFolds = useRegressionStore((state) => state.cvFolds);
  const cvResult = useRegressionStore((state) => state.cvResult);
  const validationWarnings = useRegressionStore((state) => state.validationWarnings);
  const lastResult = useRegressionStore((state) => state.lastResult);
  const isModelFitted = useRegressionStore((state) => state.isModelFitted);

  const setModelType = useRegressionStore((state) => state.setModelType);
  const setDependent = useRegressionStore((state) => state.setDependent);
  const addIndependent = useRegressionStore((state) => state.addIndependent);
  const removeIndependent = useRegressionStore((state) => state.removeIndependent);
  const setInteractionTerms = useRegressionStore((state) => state.setInteractionTerms);
  const setTrainTestSplit = useRegressionStore((state) => state.setTrainTestSplit);
  const setMissingStrategy = useRegressionStore((state) => state.setMissingStrategy);
  const setAlpha = useRegressionStore((state) => state.setAlpha);
  const setL1Ratio = useRegressionStore((state) => state.setL1Ratio);
  const setPolynomialDegree = useRegressionStore((state) => state.setPolynomialDegree);
  const setMaxDepth = useRegressionStore((state) => state.setMaxDepth);
  const setNEstimators = useRegressionStore((state) => state.setNEstimators);
  const setLearningRate = useRegressionStore((state) => state.setLearningRate);
  const setCvEnabled = useRegressionStore((state) => state.setCvEnabled);
  const setCvFolds = useRegressionStore((state) => state.setCvFolds);
  const setCvResult = useRegressionStore((state) => state.setCvResult);
  const setValidationWarnings = useRegressionStore((state) => state.setValidationWarnings);
  const setResult = useRegressionStore((state) => state.setResult);
  const clearResult = useRegressionStore((state) => state.clearResult);

  const fitMutation = useFitRegression(datasetId);
  const checkMissingMutation = useCheckMissing(datasetId);
  const crossValidationMutation = useCrossValidation(datasetId);
  const dataValidationMutation = useDataValidation(datasetId);
  const stepwiseMutation = useStepwiseSelection(datasetId);
  const bayesianMutation = useBayesianRegression(datasetId);

  const isOlsModel = isModelFitted && lastResult?.model_type === "ols";
  const isClassifierModel = isModelFitted && Boolean(lastResult?.model_type && CLASSIFIER_MODEL_TYPES.has(lastResult.model_type));

  const diagnosticsQuery = useDiagnostics(datasetId, isOlsModel);
  const confusionQuery = useConfusionMatrix(datasetId, isClassifierModel);
  const rocQuery = useRoc(datasetId, isClassifierModel);
  const vifQuery = useVIF(datasetId);
  const comparisonQuery = useModelComparison(datasetId, Boolean(datasetId));

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [missingReport, setMissingReport] = useState<Awaited<
    ReturnType<typeof checkMissingMutation.mutateAsync>
  > | null>(null);
  const [pendingRequest, setPendingRequest] = useState<RegressionRequest | null>(null);
  const [activeInsightTab, setActiveInsightTab] = useState<InsightTab>("prediction");
  const [stepwiseOpen, setStepwiseOpen] = useState(false);
  const [stepwiseCriterion, setStepwiseCriterion] = useState<"aic" | "bic">("aic");
  const [stepwiseResult, setStepwiseResult] = useState<StepwiseSelectionResponse | null>(null);
  const [stepwiseError, setStepwiseError] = useState<string | null>(null);
  const [bayesianOpen, setBayesianOpen] = useState(false);
  const [bayesianResult, setBayesianResult] = useState<BayesianRegressionResponse | null>(null);
  const [bayesianError, setBayesianError] = useState<string | null>(null);

  const columnNames = useMemo(() => columns.map((column) => column.name), [columns]);
  const isBusy =
    fitMutation.isPending ||
    checkMissingMutation.isPending ||
    crossValidationMutation.isPending ||
    dataValidationMutation.isPending;

  const buildCrossValidationRequest = (request: RegressionRequest): CrossValidationRequest => ({
    model_type: request.model_type,
    dependent: request.dependent,
    independents: request.independents,
    k: cvFolds,
    scoring: "r2",
    missing_strategy: request.missing_strategy,
    alpha: request.alpha,
    l1_ratio: request.l1_ratio,
    polynomial_degree: request.polynomial_degree,
    max_depth: request.max_depth,
    n_estimators: request.n_estimators,
    learning_rate: request.learning_rate,
  });

  const runFit = async (request: RegressionRequest) => {
    try {
      const result = await fitMutation.mutateAsync(request);
      setResult(result);

      if (cvEnabled) {
        const nextCvResult = await crossValidationMutation.mutateAsync(buildCrossValidationRequest(request));
        setCvResult(nextCvResult);
      } else {
        setCvResult(null);
      }

      void comparisonQuery.refetch();
      void vifQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["extended-diagnostics"] });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleFitModel = async () => {
    if (!datasetId || !dependent || independents.length === 0) {
      return;
    }

    const request: RegressionRequest = {
      model_type: modelType,
      dependent,
      independents,
      interaction_terms: interactionTerms,
      train_test_split: trainTestSplit,
      missing_strategy: missingStrategy,
      alpha,
      l1_ratio: l1Ratio,
      polynomial_degree: polynomialDegree,
      max_depth: maxDepth,
      n_estimators: nEstimators,
      learning_rate: learningRate,
    };

    try {
      setCvResult(null);

      const validationResult = await dataValidationMutation.mutateAsync({
        dependent,
        independents,
        model_type: modelType,
      });
      setValidationWarnings(validationResult.warnings);

      if (!validationResult.can_proceed) {
        clearResult();
        return;
      }

      const report = await checkMissingMutation.mutateAsync({
        dependent,
        independents,
      });

      if (report.has_missing) {
        setMissingReport(report);
        setPendingRequest(request);
        return;
      }

      await runFit(request);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleMissingStrategy = (strategy: "listwise" | "mean_imputation") => {
    setMissingStrategy(strategy);
    setMissingReport(null);

    if (!pendingRequest) {
      return;
    }

    const request: RegressionRequest = {
      ...pendingRequest,
      missing_strategy: strategy,
    };
    setPendingRequest(null);
    void runFit(request);
  };

  if (!datasetId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        Import a dataset to configure a regression model.
      </div>
    );
  }

  return (
    <>
      <div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-[320px_1fr]">
        <aside className="min-h-0 overflow-auto">
          <ModelConfigPanel
            columns={columnNames}
            modelType={modelType}
            dependent={dependent}
            independents={independents}
            interactionTerms={interactionTerms}
            trainTestSplit={trainTestSplit}
            missingStrategy={missingStrategy}
            alpha={alpha}
            l1Ratio={l1Ratio}
            polynomialDegree={polynomialDegree}
            maxDepth={maxDepth}
            nEstimators={nEstimators}
            learningRate={learningRate}
            cvEnabled={cvEnabled}
            cvFolds={cvFolds}
            validationWarnings={validationWarnings}
            isBusy={isBusy}
            onModelTypeChange={setModelType}
            onDependentChange={setDependent}
            onIndependentToggle={(column, checked) => {
              if (checked) {
                addIndependent(column);
                return;
              }

              removeIndependent(column);
            }}
            onInteractionTermsChange={setInteractionTerms}
            onTrainTestSplitChange={setTrainTestSplit}
            onMissingStrategyChange={setMissingStrategy}
            onAlphaChange={setAlpha}
            onL1RatioChange={setL1Ratio}
            onPolynomialDegreeChange={setPolynomialDegree}
            onMaxDepthChange={setMaxDepth}
            onNEstimatorsChange={setNEstimators}
            onLearningRateChange={setLearningRate}
            onCvEnabledChange={setCvEnabled}
            onCvFoldsChange={setCvFolds}
            onDismissWarning={(index) => {
              setValidationWarnings(validationWarnings.filter((_warning, warningIndex) => warningIndex !== index));
            }}
            onFit={handleFitModel}
          />

          <div className="mt-3 space-y-3">
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setStepwiseOpen(!stepwiseOpen)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-800"
              >
                Stepwise Selection
                <span className="text-slate-400">{stepwiseOpen ? "▲" : "▼"}</span>
              </button>
              {stepwiseOpen ? (
                <div className="space-y-3 border-t border-slate-200 px-4 pb-4 pt-3">
                  <label className="flex flex-col gap-1 text-sm text-slate-600">
                    <span>Criterion</span>
                    <select
                      aria-label="Stepwise criterion"
                      value={stepwiseCriterion}
                      onChange={(event) => setStepwiseCriterion(event.target.value as "aic" | "bic")}
                      className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                    >
                      <option value="aic">AIC</option>
                      <option value="bic">BIC</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!dependent || independents.length === 0 || stepwiseMutation.isPending}
                    onClick={async () => {
                      setStepwiseError(null);
                      setStepwiseResult(null);
                      try {
                        const result = await stepwiseMutation.mutateAsync({
                          dependent: dependent!,
                          candidates: independents,
                          criterion: stepwiseCriterion,
                        });
                        setStepwiseResult(result);
                      } catch (error) {
                        setStepwiseError(getErrorMessage(error));
                      }
                    }}
                    className="w-full rounded-md bg-lumina-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {stepwiseMutation.isPending ? "Running…" : "Run Stepwise"}
                  </button>
                  {stepwiseError ? (
                    <p className="text-sm text-red-600">{stepwiseError}</p>
                  ) : null}
                  {stepwiseResult ? (
                    <div className="space-y-2 text-sm">
                      <p className="font-medium text-slate-800">
                        Selected: {stepwiseResult.selected_variables.join(", ") || "none"}
                      </p>
                      <p className="text-slate-600">
                        Final {stepwiseResult.criterion.toUpperCase()}: {stepwiseResult.final_criterion.toFixed(2)} · N = {stepwiseResult.n_observations}
                      </p>
                      {stepwiseResult.steps.length > 0 ? (
                        <div className="overflow-auto rounded border border-slate-200">
                          <table className="min-w-full divide-y divide-slate-200 text-xs">
                            <thead className="bg-slate-50 text-left text-slate-700">
                              <tr>
                                <th className="px-2 py-1 font-semibold">Step</th>
                                <th className="px-2 py-1 font-semibold">Variable</th>
                                <th className="px-2 py-1 font-semibold">{stepwiseResult.criterion.toUpperCase()}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {stepwiseResult.steps.map((step) => (
                                <tr key={step.step}>
                                  <td className="px-2 py-1 text-slate-700">{step.step}</td>
                                  <td className="px-2 py-1 text-slate-700">{step.variable_added}</td>
                                  <td className="px-2 py-1 text-slate-700">{step.criterion_value.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setBayesianOpen(!bayesianOpen)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-800"
              >
                Bayesian Regression
                <span className="text-slate-400">{bayesianOpen ? "▲" : "▼"}</span>
              </button>
              {bayesianOpen ? (
                <div className="space-y-3 border-t border-slate-200 px-4 pb-4 pt-3">
                  <button
                    type="button"
                    disabled={!dependent || independents.length === 0 || bayesianMutation.isPending}
                    onClick={async () => {
                      setBayesianError(null);
                      setBayesianResult(null);
                      try {
                        const result = await bayesianMutation.mutateAsync({
                          dependent: dependent!,
                          independents,
                        });
                        setBayesianResult(result);
                      } catch (error) {
                        setBayesianError(getErrorMessage(error));
                      }
                    }}
                    className="w-full rounded-md bg-lumina-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {bayesianMutation.isPending ? "Running…" : "Run Bayesian"}
                  </button>
                  {bayesianError ? (
                    <p className="text-sm text-red-600">{bayesianError}</p>
                  ) : null}
                  {bayesianResult ? (
                    <div className="space-y-2 text-sm">
                      <p className="text-slate-600">
                        R² = {bayesianResult.r_squared.toFixed(4)} · N = {bayesianResult.n_observations} · {Math.round(bayesianResult.credible_level * 100)}% credible
                      </p>
                      <div className="overflow-auto rounded border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-xs">
                          <thead className="bg-slate-50 text-left text-slate-700">
                            <tr>
                              <th className="px-2 py-1 font-semibold">Variable</th>
                              <th className="px-2 py-1 font-semibold">Mean</th>
                              <th className="px-2 py-1 font-semibold">Std</th>
                              <th className="px-2 py-1 font-semibold">CI</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {bayesianResult.coefficients.map((row) => (
                              <tr key={row.variable}>
                                <td className="px-2 py-1 text-slate-700">{row.variable}</td>
                                <td className="px-2 py-1 text-slate-700">{row.posterior_mean.toFixed(4)}</td>
                                <td className="px-2 py-1 text-slate-700">{row.posterior_std.toFixed(4)}</td>
                                <td className="px-2 py-1 text-slate-700">{row.ci_lower.toFixed(4)} – {row.ci_upper.toFixed(4)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-slate-500">
                        σ² mean = {bayesianResult.sigma_squared_mean.toFixed(4)}, σ² std = {bayesianResult.sigma_squared_std.toFixed(4)}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <section className="min-h-0 space-y-3 overflow-auto">
          {lastResult ? (
            <>
              <ResultsSummary
                result={lastResult}
                cvResult={cvResult}
              />

              {lastResult.warnings.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <p className="font-semibold">Warnings</p>
                  <ul className="mt-1 list-disc pl-5">
                    {lastResult.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {comparisonQuery.data?.models.length ? (
                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold text-slate-800">Model Comparison</h2>
                  <div className="overflow-auto rounded border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 text-left text-slate-700">
                        <tr>
                          <th className="px-2 py-2 font-semibold">Model</th>
                          <th className="px-2 py-2 font-semibold">Primary Metric</th>
                          <th className="px-2 py-2 font-semibold">RMSE</th>
                          <th className="px-2 py-2 font-semibold">MAE</th>
                          <th className="px-2 py-2 font-semibold">AIC</th>
                          <th className="px-2 py-2 font-semibold">BIC</th>
                          <th className="px-2 py-2 font-semibold">F1</th>
                          <th className="px-2 py-2 font-semibold">N</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {comparisonQuery.data.models.map((model) => {
                          const primaryMetric = getComparisonPrimaryMetric(model);

                          return (
                            <tr key={model.model_id}>
                              <td className="px-2 py-2 font-medium text-slate-800">{model.model_type}</td>
                              <td className="px-2 py-2 text-slate-700">
                                {primaryMetric.label}: {formatComparisonMetric(primaryMetric.value)}
                              </td>
                              <td className="px-2 py-2 text-slate-700">{formatComparisonMetric(model.rmse)}</td>
                              <td className="px-2 py-2 text-slate-700">{formatComparisonMetric(model.mae)}</td>
                              <td className="px-2 py-2 text-slate-700">{formatComparisonMetric(model.aic)}</td>
                              <td className="px-2 py-2 text-slate-700">{formatComparisonMetric(model.bic)}</td>
                              <td className="px-2 py-2 text-slate-700">{formatComparisonMetric(model.f1)}</td>
                              <td className="px-2 py-2 text-slate-700">{model.n_observations.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {vifQuery.data?.entries.length ? (
                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-800">VIF Summary</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Variance inflation factors highlight multicollinearity; values above 10 deserve extra scrutiny.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 overflow-auto rounded border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 text-left text-slate-700">
                        <tr>
                          <th className="px-2 py-2 font-semibold">Feature</th>
                          <th className="px-2 py-2 font-semibold">VIF</th>
                          <th className="px-2 py-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {vifQuery.data.entries.map((entry) => (
                          <tr key={entry.feature} className={entry.is_high ? "bg-red-50" : undefined}>
                            <td className="px-2 py-2 font-medium text-slate-800">{entry.feature}</td>
                            <td className={`px-2 py-2 ${entry.is_high ? "font-semibold text-red-700" : "text-slate-700"}`}>
                              {entry.vif.toFixed(2)}
                            </td>
                            <td className={`px-2 py-2 ${entry.is_high ? "text-red-700" : "text-slate-600"}`}>
                              {entry.is_high ? "High" : "Acceptable"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {isOlsModel ? (
                <DiagnosticPlots
                  diagnostics={diagnosticsQuery.data}
                  isLoading={diagnosticsQuery.isLoading}
                  isError={diagnosticsQuery.isError}
                />
              ) : null}

              {isClassifierModel ? (
                <>
                  <ConfusionMatrix
                    confusion={confusionQuery.data}
                    isLoading={confusionQuery.isLoading}
                    isError={confusionQuery.isError}
                  />
                  <RocCurve roc={rocQuery.data} isLoading={rocQuery.isLoading} isError={rocQuery.isError} />
                </>
              ) : null}

              {datasetId ? (
                <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                    <button
                      type="button"
                      onClick={() => setActiveInsightTab("prediction")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                        activeInsightTab === "prediction"
                          ? "bg-lumina-700 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      Prediction
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveInsightTab("diagnostics")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                        activeInsightTab === "diagnostics"
                          ? "bg-lumina-700 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      Diagnostics
                    </button>
                  </div>

                  {activeInsightTab === "prediction" ? (
                    <PredictionPanel
                      datasetId={datasetId}
                      independents={lastResult.independents}
                      modelType={lastResult.model_type}
                    />
                  ) : (
                    <ExtendedDiagnostics datasetId={datasetId} modelType={lastResult.model_type} />
                  )}
                </section>
              ) : null}
            </>
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
              Configure variables and click <span className="mx-1 font-semibold">Fit Model</span> to view results.
            </div>
          )}
        </section>
      </div>

      {missingReport ? <MissingValueDialog report={missingReport} onSelectStrategy={handleMissingStrategy} /> : null}
      {errorMessage ? <ErrorToast message={errorMessage} onClose={() => setErrorMessage(null)} /> : null}
    </>
  );
}
