import { useMemo, useState } from "react";
import { ApiError } from "@/api/client";
import {
  useCheckMissing,
  useConfusionMatrix,
  useDiagnostics,
  useFitRegression,
  useRoc,
} from "@/api/model";
import { ErrorToast } from "@/components/Toolbar/ErrorToast";
import { useDatasetStore } from "@/stores/datasetStore";
import { useRegressionStore } from "@/stores/regressionStore";
import type { RegressionRequest } from "@/types/regression";
import { ConfusionMatrix } from "./ConfusionMatrix";
import { DiagnosticPlots } from "./DiagnosticPlots";
import { MissingValueDialog } from "./MissingValueDialog";
import { ModelConfigPanel } from "./ModelConfigPanel";
import { ResultsSummary } from "./ResultsSummary";
import { RocCurve } from "./RocCurve";

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

export function RegressionPlatform() {
  const datasetId = useDatasetStore((state) => state.datasetId);
  const columns = useDatasetStore((state) => state.columns);

  const modelType = useRegressionStore((state) => state.modelType);
  const dependent = useRegressionStore((state) => state.dependent);
  const independents = useRegressionStore((state) => state.independents);
  const trainTestSplit = useRegressionStore((state) => state.trainTestSplit);
  const missingStrategy = useRegressionStore((state) => state.missingStrategy);
  const lastResult = useRegressionStore((state) => state.lastResult);
  const isModelFitted = useRegressionStore((state) => state.isModelFitted);

  const setModelType = useRegressionStore((state) => state.setModelType);
  const setDependent = useRegressionStore((state) => state.setDependent);
  const addIndependent = useRegressionStore((state) => state.addIndependent);
  const removeIndependent = useRegressionStore((state) => state.removeIndependent);
  const setTrainTestSplit = useRegressionStore((state) => state.setTrainTestSplit);
  const setMissingStrategy = useRegressionStore((state) => state.setMissingStrategy);
  const setResult = useRegressionStore((state) => state.setResult);

  const fitMutation = useFitRegression(datasetId);
  const checkMissingMutation = useCheckMissing(datasetId);

  const isOlsModel = isModelFitted && lastResult?.model_type === "ols";
  const isLogisticModel = isModelFitted && lastResult?.model_type === "logistic";

  const diagnosticsQuery = useDiagnostics(datasetId, isOlsModel);
  const confusionQuery = useConfusionMatrix(datasetId, isLogisticModel);
  const rocQuery = useRoc(datasetId, isLogisticModel);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [missingReport, setMissingReport] = useState<Awaited<
    ReturnType<typeof checkMissingMutation.mutateAsync>
  > | null>(null);
  const [pendingRequest, setPendingRequest] = useState<RegressionRequest | null>(null);

  const columnNames = useMemo(() => columns.map((column) => column.name), [columns]);
  const isBusy = fitMutation.isPending || checkMissingMutation.isPending;

  const runFit = async (request: RegressionRequest) => {
    try {
      const result = await fitMutation.mutateAsync(request);
      setResult(result);
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
      train_test_split: trainTestSplit,
      missing_strategy: missingStrategy,
    };

    try {
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
            trainTestSplit={trainTestSplit}
            missingStrategy={missingStrategy}
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
            onTrainTestSplitChange={setTrainTestSplit}
            onMissingStrategyChange={setMissingStrategy}
            onFit={handleFitModel}
          />
        </aside>

        <section className="min-h-0 space-y-3 overflow-auto">
          {lastResult ? (
            <>
              <ResultsSummary
                result={lastResult}
                logisticAccuracy={isLogisticModel ? confusionQuery.data?.accuracy ?? null : null}
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

              {isOlsModel ? (
                <DiagnosticPlots
                  diagnostics={diagnosticsQuery.data}
                  isLoading={diagnosticsQuery.isLoading}
                  isError={diagnosticsQuery.isError}
                />
              ) : null}

              {isLogisticModel ? (
                <>
                  <ConfusionMatrix
                    confusion={confusionQuery.data}
                    isLoading={confusionQuery.isLoading}
                    isError={confusionQuery.isError}
                  />
                  <RocCurve roc={rocQuery.data} isLoading={rocQuery.isLoading} isError={rocQuery.isError} />
                </>
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
