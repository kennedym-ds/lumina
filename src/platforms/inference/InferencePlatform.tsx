import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/api/client";
import {
  useBayesianOneSample,
  useBayesianTwoSample,
  useConfidenceInterval,
  useRunAnova,
  useRunChiSquare,
  useRunTTest,
} from "@/api/inference";
import { useDatasetStore } from "@/stores/datasetStore";
import type {
  AlternativeHypothesis,
  AnovaRequest,
  AnovaResponse,
  BayesianOneSampleRequest,
  BayesianOneSampleResponse,
  BayesianTwoSampleRequest,
  BayesianTwoSampleResponse,
  CIRequest,
  CIResponse,
  ChiSquareRequest,
  ChiSquareResponse,
  TTestRequest,
  TTestResponse,
  TTestType,
} from "@/types/inference";

const SIGNIFICANCE_LEVEL = 0.05;

type InferenceResult =
  | { kind: "ttest"; data: TTestResponse }
  | { kind: "chi_square"; data: ChiSquareResponse }
  | { kind: "anova"; data: AnovaResponse }
  | { kind: "ci"; data: CIResponse }
  | { kind: "bayesian_one_sample"; data: BayesianOneSampleResponse }
  | { kind: "bayesian_two_sample"; data: BayesianTwoSampleResponse };

type InferencePanel = "ttest" | "chi_square" | "anova" | "ci" | "bayesian_one_sample" | "bayesian_two_sample";

type ColumnOption = {
  name: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.userMessage ?? error.detail ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to run the selected test.";
}

function selectValidOption(current: string, options: ColumnOption[], exclude?: string): string {
  if (current && current !== exclude && options.some((option) => option.name === current)) {
    return current;
  }

  return options.find((option) => option.name !== exclude)?.name ?? "";
}

function formatNumber(value: number | null | undefined, digits = 4): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  return value.toFixed(digits);
}

function formatPValue(value: number): string {
  if (value < 0.001) {
    return "< 0.001";
  }

  return value.toFixed(4);
}

function formatConfidenceLevel(level: number): string {
  return `${Math.round(level * 100)}%`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function interpretStandardizedEffect(value: number | null | undefined): string {
  const magnitude = Math.abs(value ?? 0);
  if (magnitude < 0.2) {
    return "Negligible effect";
  }

  if (magnitude < 0.5) {
    return "Small effect";
  }

  if (magnitude < 0.8) {
    return "Medium effect";
  }

  return "Large effect";
}

function interpretEtaSquared(value: number | null | undefined): string {
  const magnitude = Math.abs(value ?? 0);
  if (magnitude < 0.01) {
    return "Negligible effect";
  }

  if (magnitude < 0.06) {
    return "Small effect";
  }

  if (magnitude < 0.14) {
    return "Medium effect";
  }

  return "Large effect";
}

function interpretBayesFactor(value: number): string {
  if (value < 1 / 30) {
    return "Very strong evidence for H0";
  }

  if (value < 1 / 10) {
    return "Strong evidence for H0";
  }

  if (value < 1 / 3) {
    return "Moderate evidence for H0";
  }

  if (value < 1) {
    return "Anecdotal evidence for H0";
  }

  if (value < 3) {
    return "Anecdotal evidence for H1";
  }

  if (value < 10) {
    return "Moderate evidence for H1";
  }

  if (value < 30) {
    return "Strong evidence for H1";
  }

  return "Very strong evidence for H1";
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function MatrixTable({
  title,
  data,
  valueFormatter,
}: {
  title: string;
  data: Record<string, Record<string, number>>;
  valueFormatter?: (value: number) => string;
}) {
  const rows = Object.entries(data);
  const columns = rows.length > 0 ? Object.keys(rows[0][1]) : [];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="mt-3 overflow-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-500">Group</th>
              {columns.map((column) => (
                <th key={column} className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([rowLabel, rowValues]) => (
              <tr key={rowLabel}>
                <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-700">{rowLabel}</td>
                {columns.map((column) => (
                  <td key={`${rowLabel}-${column}`} className="border-b border-slate-100 px-3 py-2 text-slate-600">
                    {valueFormatter ? valueFormatter(rowValues[column]) : rowValues[column]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InferencePlatform() {
  const datasetId = useDatasetStore((state) => state.datasetId);
  const columns = useDatasetStore((state) => state.columns);

  const numericColumns = useMemo(() => columns.filter((column) => column.dtype === "numeric"), [columns]);
  const groupColumns = useMemo(
    () => columns.filter((column) => column.dtype === "categorical" || column.dtype === "boolean" || column.dtype === "text"),
    [columns],
  );

  const [panel, setPanel] = useState<InferencePanel>("ttest");
  const [tTestType, setTTestType] = useState<TTestType>("independent");
  const [valueColumn, setValueColumn] = useState("");
  const [comparisonColumn, setComparisonColumn] = useState("");
  const [groupColumn, setGroupColumn] = useState("");
  const [groupA, setGroupA] = useState("");
  const [groupB, setGroupB] = useState("");
  const [mu, setMu] = useState("0");
  const [alternative, setAlternative] = useState<AlternativeHypothesis>("two-sided");
  const [chiSquareRowColumn, setChiSquareRowColumn] = useState("");
  const [chiSquareColumnColumn, setChiSquareColumnColumn] = useState("");
  const [anovaNumericColumn, setAnovaNumericColumn] = useState("");
  const [anovaGroupColumn, setAnovaGroupColumn] = useState("");
  const [ciColumn, setCiColumn] = useState("");
  const [ciLevel, setCiLevel] = useState("0.95");
  const [bayesianColumn, setBayesianColumn] = useState("");
  const [bayesianPriorMu, setBayesianPriorMu] = useState("0");
  const [bayesianPriorSigma, setBayesianPriorSigma] = useState("1000000");
  const [bayesianCredibleLevel, setBayesianCredibleLevel] = useState("0.95");
  const [bayesianGroupAColumn, setBayesianGroupAColumn] = useState("");
  const [bayesianGroupBColumn, setBayesianGroupBColumn] = useState("");
  const [bayesianTwoSampleCredibleLevel, setBayesianTwoSampleCredibleLevel] = useState("0.95");
  const [result, setResult] = useState<InferenceResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const tTestMutation = useRunTTest(datasetId);
  const chiSquareMutation = useRunChiSquare(datasetId);
  const anovaMutation = useRunAnova(datasetId);
  const ciMutation = useConfidenceInterval(datasetId);
  const bayesianOneSampleMutation = useBayesianOneSample(datasetId);
  const bayesianTwoSampleMutation = useBayesianTwoSample(datasetId);

  useEffect(() => {
    setValueColumn((current) => selectValidOption(current, numericColumns));
    setComparisonColumn((current) => selectValidOption(current, numericColumns, valueColumn));
    setGroupColumn((current) => selectValidOption(current, groupColumns));
    setChiSquareRowColumn((current) => selectValidOption(current, groupColumns));
    setChiSquareColumnColumn((current) => selectValidOption(current, groupColumns, chiSquareRowColumn));
    setAnovaNumericColumn((current) => selectValidOption(current, numericColumns));
    setAnovaGroupColumn((current) => selectValidOption(current, groupColumns));
    setCiColumn((current) => selectValidOption(current, numericColumns));
    setBayesianColumn((current) => selectValidOption(current, numericColumns));
    setBayesianGroupAColumn((current) => selectValidOption(current, numericColumns));
    setBayesianGroupBColumn((current) => selectValidOption(current, numericColumns, bayesianGroupAColumn));
  }, [datasetId, numericColumns, groupColumns, valueColumn, chiSquareRowColumn, bayesianGroupAColumn]);

  useEffect(() => {
    setComparisonColumn((current) => selectValidOption(current, numericColumns, valueColumn));
  }, [valueColumn, numericColumns]);

  useEffect(() => {
    setChiSquareColumnColumn((current) => selectValidOption(current, groupColumns, chiSquareRowColumn));
  }, [chiSquareRowColumn, groupColumns]);

  useEffect(() => {
    setBayesianGroupBColumn((current) => selectValidOption(current, numericColumns, bayesianGroupAColumn));
  }, [bayesianGroupAColumn, numericColumns]);

  const isLoading = Boolean(
    tTestMutation.isPending ||
      chiSquareMutation.isPending ||
      anovaMutation.isPending ||
      ciMutation.isPending ||
      bayesianOneSampleMutation.isPending ||
      bayesianTwoSampleMutation.isPending,
  );

  const canRun = useMemo(() => {
    if (panel === "ttest") {
      if (tTestType === "independent") {
        return Boolean(valueColumn && groupColumn && groupA.trim() && groupB.trim());
      }

      if (tTestType === "paired") {
        return Boolean(valueColumn && comparisonColumn && valueColumn !== comparisonColumn);
      }

      return Boolean(valueColumn);
    }

    if (panel === "chi_square") {
      return Boolean(chiSquareRowColumn && chiSquareColumnColumn && chiSquareRowColumn !== chiSquareColumnColumn);
    }

    if (panel === "ci") {
      return Boolean(ciColumn);
    }

    if (panel === "bayesian_one_sample") {
      const priorMuValue = Number(bayesianPriorMu);
      const priorSigmaValue = Number(bayesianPriorSigma);
      const credibleLevelValue = Number(bayesianCredibleLevel);
      return Boolean(
        bayesianColumn &&
          Number.isFinite(priorMuValue) &&
          Number.isFinite(priorSigmaValue) &&
          priorSigmaValue > 0 &&
          credibleLevelValue > 0 &&
          credibleLevelValue < 1,
      );
    }

    if (panel === "bayesian_two_sample") {
      const credibleLevelValue = Number(bayesianTwoSampleCredibleLevel);
      return Boolean(
        bayesianGroupAColumn &&
          bayesianGroupBColumn &&
          bayesianGroupAColumn !== bayesianGroupBColumn &&
          credibleLevelValue > 0 &&
          credibleLevelValue < 1,
      );
    }

    return Boolean(anovaNumericColumn && anovaGroupColumn);
  }, [
    anovaGroupColumn,
    anovaNumericColumn,
    bayesianColumn,
    bayesianCredibleLevel,
    bayesianGroupAColumn,
    bayesianGroupBColumn,
    bayesianPriorMu,
    bayesianPriorSigma,
    bayesianTwoSampleCredibleLevel,
    ciColumn,
    chiSquareColumnColumn,
    chiSquareRowColumn,
    comparisonColumn,
    groupA,
    groupB,
    groupColumn,
    panel,
    tTestType,
    valueColumn,
  ]);

  const handleRun = async () => {
    setErrorMessage(null);
    setResult(null);

    try {
      if (panel === "ttest") {
        const request: TTestRequest = {
          test_type: tTestType,
          column_a: valueColumn,
          alternative,
          mu: Number(mu) || 0,
        };

        if (tTestType === "independent") {
          request.group_column = groupColumn;
          request.group_a = groupA.trim();
          request.group_b = groupB.trim();
        }

        if (tTestType === "paired") {
          request.column_b = comparisonColumn;
        }

        const response = await tTestMutation.mutateAsync(request);
        setResult({ kind: "ttest", data: response });
        return;
      }

      if (panel === "chi_square") {
        const request: ChiSquareRequest = {
          column_a: chiSquareRowColumn,
          column_b: chiSquareColumnColumn,
        };

        const response = await chiSquareMutation.mutateAsync(request);
        setResult({ kind: "chi_square", data: response });
        return;
      }

      if (panel === "ci") {
        const request: CIRequest = {
          column: ciColumn,
          confidence_level: Number(ciLevel),
        };

        const response = await ciMutation.mutateAsync(request);
        setResult({ kind: "ci", data: response });
        return;
      }

      if (panel === "bayesian_one_sample") {
        const request: BayesianOneSampleRequest = {
          column: bayesianColumn,
          prior_mu: Number(bayesianPriorMu) || 0,
          prior_sigma: Number(bayesianPriorSigma) || 1e6,
          credible_level: Number(bayesianCredibleLevel),
        };

        const response = await bayesianOneSampleMutation.mutateAsync(request);
        setResult({ kind: "bayesian_one_sample", data: response });
        return;
      }

      if (panel === "bayesian_two_sample") {
        const request: BayesianTwoSampleRequest = {
          column_a: bayesianGroupAColumn,
          column_b: bayesianGroupBColumn,
          credible_level: Number(bayesianTwoSampleCredibleLevel),
        };

        const response = await bayesianTwoSampleMutation.mutateAsync(request);
        setResult({ kind: "bayesian_two_sample", data: response });
        return;
      }

      const request: AnovaRequest = {
        numeric_column: anovaNumericColumn,
        group_column: anovaGroupColumn,
      };
      const response = await anovaMutation.mutateAsync(request);
      setResult({ kind: "anova", data: response });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  if (!datasetId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        Import a dataset to run statistical inference.
      </div>
    );
  }

  const significant =
    result && (result.kind === "ttest" || result.kind === "chi_square" || result.kind === "anova")
      ? result.data.p_value < SIGNIFICANCE_LEVEL
      : null;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-[360px_1fr]">
      <aside className="min-h-0 overflow-auto rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "ttest" as const, label: "T-Test" },
            { key: "chi_square" as const, label: "Chi-Square" },
            { key: "anova" as const, label: "ANOVA" },
            { key: "ci" as const, label: "Confidence Interval" },
            { key: "bayesian_one_sample" as const, label: "Bayesian One-Sample" },
            { key: "bayesian_two_sample" as const, label: "Bayesian Two-Sample" },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setPanel(option.key)}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                panel === option.key
                  ? "bg-lumina-600 text-white"
                  : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          {panel === "ttest" ? (
            <>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span>T-test type</span>
                <select
                  aria-label="T-test type"
                  value={tTestType}
                  onChange={(event) => setTTestType(event.target.value as TTestType)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  <option value="independent">Independent</option>
                  <option value="paired">Paired</option>
                  <option value="one_sample">One-sample</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span>Value column</span>
                <select
                  aria-label="Value column"
                  value={valueColumn}
                  onChange={(event) => setValueColumn(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  {numericColumns.map((column) => (
                    <option key={column.name} value={column.name}>
                      {column.name}
                    </option>
                  ))}
                </select>
              </label>

              {tTestType === "paired" ? (
                <label className="flex flex-col gap-1 text-sm text-slate-600">
                  <span>Comparison column</span>
                  <select
                    aria-label="Comparison column"
                    value={comparisonColumn}
                    onChange={(event) => setComparisonColumn(event.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2"
                  >
                    {numericColumns
                      .filter((column) => column.name !== valueColumn)
                      .map((column) => (
                        <option key={column.name} value={column.name}>
                          {column.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}

              {tTestType === "independent" ? (
                <>
                  <label className="flex flex-col gap-1 text-sm text-slate-600">
                    <span>Grouping column</span>
                    <select
                      aria-label="Grouping column"
                      value={groupColumn}
                      onChange={(event) => setGroupColumn(event.target.value)}
                      className="rounded-md border border-slate-300 px-3 py-2"
                    >
                      {groupColumns.map((column) => (
                        <option key={column.name} value={column.name}>
                          {column.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-slate-600">
                    <span>Group A label</span>
                    <input
                      aria-label="Group A label"
                      type="text"
                      value={groupA}
                      onChange={(event) => setGroupA(event.target.value)}
                      placeholder="e.g. Control"
                      className="rounded-md border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-slate-600">
                    <span>Group B label</span>
                    <input
                      aria-label="Group B label"
                      type="text"
                      value={groupB}
                      onChange={(event) => setGroupB(event.target.value)}
                      placeholder="e.g. Treatment"
                      className="rounded-md border border-slate-300 px-3 py-2"
                    />
                  </label>
                </>
              ) : null}

              {tTestType === "one_sample" ? (
                <label className="flex flex-col gap-1 text-sm text-slate-600">
                  <span>Reference mean (μ)</span>
                  <input
                    aria-label="Reference mean"
                    type="number"
                    value={mu}
                    onChange={(event) => setMu(event.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
              ) : null}

              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span>Alternative hypothesis</span>
                <select
                  aria-label="Alternative hypothesis"
                  value={alternative}
                  onChange={(event) => setAlternative(event.target.value as AlternativeHypothesis)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  <option value="two-sided">Two-sided</option>
                  <option value="less">Less than</option>
                  <option value="greater">Greater than</option>
                </select>
              </label>
            </>
          ) : null}

          {panel === "chi_square" ? (
            <>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span>Row column</span>
                <select
                  aria-label="Row column"
                  value={chiSquareRowColumn}
                  onChange={(event) => setChiSquareRowColumn(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  {groupColumns.map((column) => (
                    <option key={column.name} value={column.name}>
                      {column.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span>Column column</span>
                <select
                  aria-label="Column column"
                  value={chiSquareColumnColumn}
                  onChange={(event) => setChiSquareColumnColumn(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  {groupColumns
                    .filter((column) => column.name !== chiSquareRowColumn)
                    .map((column) => (
                      <option key={column.name} value={column.name}>
                        {column.name}
                      </option>
                    ))}
                </select>
              </label>
            </>
          ) : null}

          {panel === "anova" ? (
            <>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span>Numeric column</span>
                <select
                  aria-label="Numeric column"
                  value={anovaNumericColumn}
                  onChange={(event) => setAnovaNumericColumn(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  {numericColumns.map((column) => (
                    <option key={column.name} value={column.name}>
                      {column.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span>Group column</span>
                <select
                  aria-label="Group column"
                  value={anovaGroupColumn}
                  onChange={(event) => setAnovaGroupColumn(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  {groupColumns.map((column) => (
                    <option key={column.name} value={column.name}>
                      {column.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {panel === "ci" ? (
            <>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span>Confidence interval column</span>
                <select
                  aria-label="Confidence interval column"
                  value={ciColumn}
                  onChange={(event) => setCiColumn(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  {numericColumns.map((column) => (
                    <option key={column.name} value={column.name}>
                      {column.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span>Confidence level</span>
                <select
                  aria-label="Confidence level"
                  value={ciLevel}
                  onChange={(event) => setCiLevel(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  <option value="0.9">90%</option>
                  <option value="0.95">95%</option>
                  <option value="0.99">99%</option>
                </select>
              </label>
            </>
          ) : null}

          {panel === "bayesian_one_sample" ? (
            <>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span>Bayesian sample column</span>
                <select
                  aria-label="Bayesian sample column"
                  value={bayesianColumn}
                  onChange={(event) => setBayesianColumn(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  {numericColumns.map((column) => (
                    <option key={column.name} value={column.name}>
                      {column.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span>Prior mean</span>
                <input
                  aria-label="Prior mean"
                  type="number"
                  value={bayesianPriorMu}
                  onChange={(event) => setBayesianPriorMu(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span>Prior sigma</span>
                <input
                  aria-label="Prior sigma"
                  type="number"
                  min="0.0001"
                  step="0.1"
                  value={bayesianPriorSigma}
                  onChange={(event) => setBayesianPriorSigma(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span>Credible level</span>
                <select
                  aria-label="Credible level"
                  value={bayesianCredibleLevel}
                  onChange={(event) => setBayesianCredibleLevel(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  <option value="0.9">90%</option>
                  <option value="0.95">95%</option>
                  <option value="0.99">99%</option>
                </select>
              </label>
            </>
          ) : null}

          {panel === "bayesian_two_sample" ? (
            <>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span>Bayesian group A column</span>
                <select
                  aria-label="Bayesian group A column"
                  value={bayesianGroupAColumn}
                  onChange={(event) => setBayesianGroupAColumn(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  {numericColumns.map((column) => (
                    <option key={column.name} value={column.name}>
                      {column.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span>Bayesian group B column</span>
                <select
                  aria-label="Bayesian group B column"
                  value={bayesianGroupBColumn}
                  onChange={(event) => setBayesianGroupBColumn(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  {numericColumns
                    .filter((column) => column.name !== bayesianGroupAColumn)
                    .map((column) => (
                      <option key={column.name} value={column.name}>
                        {column.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span>Credible level</span>
                <select
                  aria-label="Credible level"
                  value={bayesianTwoSampleCredibleLevel}
                  onChange={(event) => setBayesianTwoSampleCredibleLevel(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  <option value="0.9">90%</option>
                  <option value="0.95">95%</option>
                  <option value="0.99">99%</option>
                </select>
              </label>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={!canRun || isLoading}
            className="w-full rounded-md bg-lumina-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isLoading ? "Running…" : "Run Test"}
          </button>
        </div>
      </aside>

      <section className="min-h-0 overflow-auto space-y-3">
        {errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
        ) : null}

        {!result ? (
          <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
            Configure a hypothesis test and click <span className="mx-1 font-semibold">Run Test</span> to view results.
          </div>
        ) : (
          <>
            {result.kind === "ci" ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Confidence interval summary</h2>
                  <p className="text-sm text-slate-500">
                    Review the mean estimate, interval bounds, and sampling precision for the selected column.
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <StatCard label="Column" value={result.data.column} />
                  <StatCard label="Mean" value={formatNumber(result.data.mean)} />
                  <StatCard label={`${formatConfidenceLevel(result.data.confidence_level)} lower bound`} value={formatNumber(result.data.ci_lower)} />
                  <StatCard label={`${formatConfidenceLevel(result.data.confidence_level)} upper bound`} value={formatNumber(result.data.ci_upper)} />
                  <StatCard label="Standard error" value={formatNumber(result.data.std_error)} />
                  <StatCard label="Sample size" value={String(result.data.n)} />
                </div>
              </div>
            ) : null}

            {result.kind === "bayesian_one_sample" ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">Bayesian posterior summary</h2>
                    <p className="text-sm text-slate-500">
                      Review the posterior estimate, credible interval, and Bayes factor evidence for the selected numeric column.
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Posterior mean" value={formatNumber(result.data.posterior_mean)} />
                    <StatCard label="Posterior std" value={formatNumber(result.data.posterior_std)} />
                    <StatCard label="Bayes factor (BF10)" value={formatNumber(result.data.bayes_factor_10, 2)} />
                    <StatCard label="Interpretation" value={interpretBayesFactor(result.data.bayes_factor_10)} />
                    <StatCard
                      label={`${formatConfidenceLevel(result.data.credible_level)} lower bound`}
                      value={formatNumber(result.data.ci_lower)}
                    />
                    <StatCard
                      label={`${formatConfidenceLevel(result.data.credible_level)} upper bound`}
                      value={formatNumber(result.data.ci_upper)}
                    />
                    <StatCard label="Sample mean" value={formatNumber(result.data.sample_mean)} />
                    <StatCard label="Sample size" value={String(result.data.n)} />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800">Observed sample summary</h3>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <StatCard label="Sample mean" value={formatNumber(result.data.sample_mean)} />
                    <StatCard label="Sample std" value={formatNumber(result.data.sample_std)} />
                    <StatCard label="Credible interval" value={`${formatNumber(result.data.ci_lower)} to ${formatNumber(result.data.ci_upper)}`} />
                  </div>
                </div>
              </div>
            ) : null}

            {result.kind === "bayesian_two_sample" ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">Bayesian difference summary</h2>
                    <p className="text-sm text-slate-500">
                      Compare the posterior mean difference between two numeric columns and quantify the probability that the gap is positive.
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Difference mean" value={formatNumber(result.data.difference_mean)} />
                    <StatCard label="Difference std" value={formatNumber(result.data.difference_std)} />
                    <StatCard label="Probability difference > 0" value={formatPercent(result.data.prob_greater_than_zero)} />
                    <StatCard label="Credible interval" value={`${formatNumber(result.data.ci_lower)} to ${formatNumber(result.data.ci_upper)}`} />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800">Group posteriors</h3>
                  <div className="mt-3 overflow-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-500">Group</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-500">Posterior mean</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-500">Sample mean</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-500">Bayes factor (BF10)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "Group A", data: result.data.group_a },
                          { label: "Group B", data: result.data.group_b },
                        ].map((group) => (
                          <tr key={group.label}>
                            <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{group.label}</td>
                            <td className="border-b border-slate-100 px-3 py-2 text-slate-600">{formatNumber(group.data.posterior_mean)}</td>
                            <td className="border-b border-slate-100 px-3 py-2 text-slate-600">{formatNumber(group.data.sample_mean)}</td>
                            <td className="border-b border-slate-100 px-3 py-2 text-slate-600">{formatNumber(group.data.bayes_factor_10, 2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            {(result.kind === "ttest" || result.kind === "chi_square" || result.kind === "anova") ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">Inference results</h2>
                    <p className="text-sm text-slate-500">Review the test statistic, p-value, and supporting summary metrics.</p>
                  </div>
                  {significant !== null ? (
                    <div
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        significant ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {significant ? "Significant at α = 0.05" : "Not significant at α = 0.05"}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
                  <StatCard label="Statistic" value={formatNumber(result.data.statistic)} />
                  <StatCard label="P-value" value={formatPValue(result.data.p_value)} />
                  {result.kind === "ttest" ? <StatCard label="Degrees of freedom" value={formatNumber(result.data.df)} /> : null}
                  {result.kind === "chi_square" ? <StatCard label="Degrees of freedom" value={String(result.data.df)} /> : null}
                  {result.kind === "anova" ? (
                    <>
                      <StatCard label="DF between" value={String(result.data.df_between)} />
                      <StatCard label="DF within" value={String(result.data.df_within)} />
                    </>
                  ) : null}
                  {result.kind === "ttest" ? <StatCard label="Alternative" value={result.data.alternative} /> : null}
                  {result.kind === "ttest" ? (
                    <StatCard label={result.data.effect_size_label} value={formatNumber(result.data.effect_size)} />
                  ) : null}
                  {result.kind === "chi_square" ? (
                    <>
                      <StatCard label="Cramér's V" value={formatNumber(result.data.cramers_v)} />
                      <StatCard label="N total" value={result.data.n_total ? String(result.data.n_total) : "—"} />
                    </>
                  ) : null}
                  {result.kind === "anova" ? <StatCard label="Eta squared" value={formatNumber(result.data.eta_squared)} /> : null}
                </div>
              </div>
            ) : null}

            {result.kind === "ttest" ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800">Effect size and interval</h3>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <StatCard label={result.data.effect_size_label} value={formatNumber(result.data.effect_size)} />
                    <StatCard label="Interpretation" value={interpretStandardizedEffect(result.data.effect_size)} />
                    <StatCard
                      label={`${formatConfidenceLevel(result.data.ci_level)} CI of mean difference`}
                      value={`${formatNumber(result.data.ci_lower)} to ${formatNumber(result.data.ci_upper)}`}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800">Sample summary</h3>
                  <div className="mt-3 overflow-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-500">Sample</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-500">Mean</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-500">N</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border-b border-slate-100 px-3 py-2 text-slate-700">Sample A</td>
                          <td className="border-b border-slate-100 px-3 py-2 text-slate-600">{formatNumber(result.data.mean_a)}</td>
                          <td className="border-b border-slate-100 px-3 py-2 text-slate-600">{result.data.n_a}</td>
                        </tr>
                        <tr>
                          <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{result.data.test_type === "one_sample" ? "Reference μ" : "Sample B"}</td>
                          <td className="border-b border-slate-100 px-3 py-2 text-slate-600">{formatNumber(result.data.mean_b)}</td>
                          <td className="border-b border-slate-100 px-3 py-2 text-slate-600">{result.data.n_b ?? "—"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            {result.kind === "chi_square" ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800">Association strength</h3>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <StatCard label="Cramér's V" value={formatNumber(result.data.cramers_v)} />
                    <StatCard label="Sample size" value={result.data.n_total ? String(result.data.n_total) : "—"} />
                  </div>
                </div>
                <MatrixTable title="Contingency table" data={result.data.contingency_table} />
                <MatrixTable
                  title="Expected frequencies"
                  data={result.data.expected_frequencies}
                  valueFormatter={(value) => formatNumber(value, 2)}
                />
              </div>
            ) : null}

            {result.kind === "anova" ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800">Effect size</h3>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <StatCard label="Eta squared" value={formatNumber(result.data.eta_squared)} />
                    <StatCard label="Interpretation" value={interpretEtaSquared(result.data.eta_squared)} />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800">Group summary</h3>
                  <div className="mt-3 overflow-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-500">Group</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-500">Mean</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-500">N</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(result.data.group_means).map((group) => (
                          <tr key={group}>
                            <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{group}</td>
                            <td className="border-b border-slate-100 px-3 py-2 text-slate-600">
                              {formatNumber(result.data.group_means[group])}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 text-slate-600">
                              {result.data.group_sizes[group]}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
