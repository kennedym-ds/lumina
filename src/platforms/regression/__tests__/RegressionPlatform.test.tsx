// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ApiError } from "@/api/client";
import { AppLayout } from "@/components/Layout/AppLayout";
import { RegressionPlatform } from "@/platforms/regression/RegressionPlatform";
import { useDatasetStore } from "@/stores/datasetStore";
import { useRegressionStore } from "@/stores/regressionStore";

const fitMutateAsync = vi.fn();
const checkMissingMutateAsync = vi.fn();
const crossValidationMutateAsync = vi.fn();
const dataValidationMutateAsync = vi.fn();
const comparisonRefetch = vi.fn();

let vifQueryState = {
  data: undefined as { entries: Array<{ feature: string; vif: number; is_high: boolean }> } | undefined,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

let comparisonQueryState = {
  data: { models: [] as Array<Record<string, unknown>> },
  isLoading: false,
  isError: false,
};

vi.mock("react-resizable-panels", () => ({
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Panel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Separator: () => <div data-testid="separator" />,
  useDefaultLayout: () => ({
    defaultLayout: undefined,
    onLayoutChanged: () => undefined,
  }),
}));

vi.mock("@/api/model", () => ({
  useFitRegression: () => ({ mutateAsync: fitMutateAsync, isPending: false }),
  useCheckMissing: () => ({ mutateAsync: checkMissingMutateAsync, isPending: false }),
  useCrossValidation: () => ({ mutateAsync: crossValidationMutateAsync, isPending: false }),
  useDataValidation: () => ({ mutateAsync: dataValidationMutateAsync, isPending: false }),
  useDiagnostics: () => ({ data: null, isLoading: false, isError: false }),
  useConfusionMatrix: () => ({ data: null, isLoading: false, isError: false }),
  useRoc: () => ({ data: null, isLoading: false, isError: false }),
  useVIF: () => vifQueryState,
  useModelComparison: () => ({ ...comparisonQueryState, refetch: comparisonRefetch }),
  useStepwiseSelection: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBayesianRegression: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/components/Import/ImportDialog", () => ({
  ImportDialog: () => <div>Import Dialog</div>,
}));

vi.mock("@/components/DataTable/DataTable", () => ({
  DataTable: () => <div>Data Table</div>,
}));

vi.mock("@/components/Sidebar/SummaryPanel", () => ({
  SummaryPanel: () => <div>Summary Panel</div>,
}));

vi.mock("@/components/FilterBuilder/FilterBuilder", () => ({
  FilterBuilder: () => <div>Filter Builder</div>,
}));

vi.mock("@/components/Sidebar/VariableList", () => ({
  VariableList: () => <div>Variable List</div>,
}));

vi.mock("@/components/Toolbar/ResetSelectionButton", () => ({
  ResetSelectionButton: () => null,
}));

vi.mock("@/components/Toolbar/OpenButton", () => ({
  OpenButton: () => null,
}));

vi.mock("@/components/Toolbar/SaveButton", () => ({
  SaveButton: () => null,
}));

vi.mock("@/components/Toolbar/ExportChartButton", () => ({
  ExportChartButton: () => null,
}));

vi.mock("@/hooks/useUnsavedChanges", () => ({
  useUnsavedChanges: () => ({
    isDirty: false,
    markClean: () => undefined,
  }),
}));

vi.mock("@/platforms/eda/EdaPlatform", () => ({
  EdaPlatform: () => <div>EDA</div>,
}));

vi.mock("@/platforms/regression/DiagnosticPlots", () => ({
  DiagnosticPlots: () => <div>Diagnostic Plots</div>,
}));

vi.mock("@/platforms/regression/ConfusionMatrix", () => ({
  ConfusionMatrix: () => <div>Confusion Matrix</div>,
}));

vi.mock("@/platforms/regression/RocCurve", () => ({
  RocCurve: () => <div>ROC Curve</div>,
}));

vi.mock("@/platforms/regression/PredictionPanel", () => ({
  PredictionPanel: () => <div>Prediction Panel</div>,
}));

vi.mock("@/platforms/regression/ExtendedDiagnostics", () => ({
  ExtendedDiagnostics: () => <div>Extended Diagnostics</div>,
}));

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithQuery(ui: ReactNode) {
  const client = createClient();
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}

describe("RegressionPlatform", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    fitMutateAsync.mockReset();
    checkMissingMutateAsync.mockReset();
    crossValidationMutateAsync.mockReset();
    dataValidationMutateAsync.mockReset();
    dataValidationMutateAsync.mockResolvedValue({
      can_proceed: true,
      warnings: [],
    });
    comparisonRefetch.mockReset();
    vifQueryState = {
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    comparisonQueryState = {
      data: { models: [] },
      isLoading: false,
      isError: false,
    };
    useRegressionStore.getState().reset();
    useDatasetStore.getState().clearDataset();

    useDatasetStore.getState().setDataset({
      dataset_id: "ds_1",
      file_name: "sample.csv",
      file_format: "csv",
      row_count: 100,
      column_count: 3,
      columns: [
        { name: "target", dtype: "numeric", original_dtype: "float64", missing_count: 0, unique_count: 100 },
        { name: "x1", dtype: "numeric", original_dtype: "float64", missing_count: 0, unique_count: 100 },
        { name: "x2", dtype: "numeric", original_dtype: "float64", missing_count: 0, unique_count: 100 },
      ],
    });
  });

  it("renders config panel with all eleven model type buttons", () => {
    renderWithQuery(<RegressionPlatform />);

    expect(screen.getByRole("button", { name: "OLS" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Logistic" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ridge" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lasso" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ElasticNet" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decision Tree" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Random Forest" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "DT Classifier" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "RF Classifier" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gradient Boost" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "GB Classifier" })).toBeTruthy();
  });

  it("toggles regularization controls by model type", () => {
    renderWithQuery(<RegressionPlatform />);

    expect(screen.getByLabelText("Polynomial Degree")).toBeTruthy();
    expect(screen.queryByLabelText("Alpha")).toBeNull();
    expect(screen.queryByLabelText("L1 Ratio")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Ridge" }));
    expect(screen.getByLabelText("Alpha")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "ElasticNet" }));
    expect(screen.getByLabelText("L1 Ratio")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Logistic" }));
    expect(screen.queryByLabelText("Alpha")).toBeNull();
    expect(screen.queryByLabelText("Polynomial Degree")).toBeNull();
    expect(screen.queryByLabelText("L1 Ratio")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Decision Tree" }));
    expect(screen.getByLabelText("Max Depth")).toBeTruthy();
    expect(screen.queryByLabelText("Polynomial Degree")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Random Forest" }));
    expect(screen.getByLabelText("Max Depth")).toBeTruthy();
    expect(screen.getByLabelText("Number of Trees")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Gradient Boost" }));
    expect(screen.getByLabelText("Max Depth")).toBeTruthy();
    expect(screen.getByLabelText("Number of Trees")).toBeTruthy();
    expect(screen.getByLabelText("Learning Rate")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "GB Classifier" }));
    expect(screen.getByLabelText("Learning Rate")).toBeTruthy();
    expect(screen.queryByLabelText("Polynomial Degree")).toBeNull();
  });

  it("fit button disabled when no variables selected", () => {
    renderWithQuery(<RegressionPlatform />);

    expect((screen.getByRole("button", { name: "Fit Model" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders regression tab in layout", () => {
    renderWithQuery(
      <AppLayout
        onUpload={async () => {
          throw new Error("not used");
        }}
        isUploading={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Regression" })).toBeTruthy();
  });

  it("shows error toast on fit failure", async () => {
    checkMissingMutateAsync.mockResolvedValue({
      has_missing: false,
      columns_with_missing: [],
      total_rows_affected: 0,
      recommendation: "",
    });

    fitMutateAsync.mockRejectedValue(
      new ApiError(422, "MODEL_FIT_FAILED", "Singular matrix", "Check for collinear variables."),
    );

    renderWithQuery(<RegressionPlatform />);

    fireEvent.change(screen.getByLabelText("Dependent Variable"), { target: { value: "target" } });
    fireEvent.click(screen.getByLabelText("x1"));
    fireEvent.click(screen.getByRole("button", { name: "Fit Model" }));

    expect(await screen.findByText("Check for collinear variables.")).toBeTruthy();
  });

  it("shows coefficient table after fit", async () => {
    checkMissingMutateAsync.mockResolvedValue({
      has_missing: false,
      columns_with_missing: [],
      total_rows_affected: 0,
      recommendation: "",
    });

    fitMutateAsync.mockResolvedValue({
      model_id: "model_1",
      model_type: "ols",
      dependent: "target",
      independents: ["x1"],
      coefficients: [
        {
          variable: "const",
          coefficient: 1.23,
          std_error: 0.2,
          t_stat: 6.15,
          z_stat: null,
          p_value: 0.01,
          ci_lower: 0.8,
          ci_upper: 1.6,
        },
      ],
      r_squared: 0.88,
      adj_r_squared: 0.86,
      f_statistic: 12.4,
      f_pvalue: 0.001,
      aic: 120.4,
      bic: 130.6,
      rmse: 0.22,
      mae: 0.18,
      n_observations: 100,
      n_train: 100,
      n_test: null,
      warnings: [],
    });

    renderWithQuery(<RegressionPlatform />);

    fireEvent.change(screen.getByLabelText("Dependent Variable"), { target: { value: "target" } });
    fireEvent.click(screen.getByLabelText("x1"));
    fireEvent.click(screen.getByRole("button", { name: "Fit Model" }));

    expect(await screen.findByText("Coefficients")).toBeTruthy();
    expect(screen.getByText("const")).toBeTruthy();
    expect(screen.getByText("RMSE")).toBeTruthy();
    expect(screen.getByText("MAE")).toBeTruthy();
  });

  it("invalidates extended diagnostics after a successful fit", async () => {
    checkMissingMutateAsync.mockResolvedValue({
      has_missing: false,
      columns_with_missing: [],
      total_rows_affected: 0,
      recommendation: "",
    });

    fitMutateAsync.mockResolvedValue({
      model_id: "model_invalidate_1",
      model_type: "ridge",
      dependent: "target",
      independents: ["x1"],
      coefficients: [],
      feature_importances: null,
      r_squared: 0.82,
      adj_r_squared: null,
      f_statistic: null,
      f_pvalue: null,
      aic: null,
      bic: null,
      rmse: 0.28,
      mae: 0.18,
      n_observations: 100,
      n_train: 100,
      n_test: null,
      warnings: [],
    });

    const { client } = renderWithQuery(<RegressionPlatform />);
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    fireEvent.change(screen.getByLabelText("Dependent Variable"), { target: { value: "target" } });
    fireEvent.click(screen.getByLabelText("x1"));
    fireEvent.click(screen.getByRole("button", { name: "Fit Model" }));

    await screen.findByText("Coefficients");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["extended-diagnostics"] });
  });

  it("renders feature importances and model comparison after a tree fit", async () => {
    checkMissingMutateAsync.mockResolvedValue({
      has_missing: false,
      columns_with_missing: [],
      total_rows_affected: 0,
      recommendation: "",
    });

    comparisonQueryState = {
      data: {
        models: [
          {
            model_id: "model_tree_1",
            model_type: "decision_tree",
            r_squared: 0.74,
            rmse: 0.42,
            mae: 0.29,
            aic: null,
            bic: null,
            accuracy: null,
            f1: null,
            n_observations: 100,
          },
        ],
      },
      isLoading: false,
      isError: false,
    };

    fitMutateAsync.mockResolvedValue({
      model_id: "model_tree_1",
      model_type: "decision_tree",
      dependent: "target",
      independents: ["x1", "x2"],
      coefficients: [
        {
          variable: "x1",
          coefficient: 0.61,
          std_error: null,
          t_stat: null,
          z_stat: null,
          p_value: null,
          ci_lower: null,
          ci_upper: null,
        },
      ],
      feature_importances: [
        { feature: "x1", importance: 0.61 },
        { feature: "x2", importance: 0.39 },
      ],
      r_squared: 0.74,
      adj_r_squared: null,
      f_statistic: null,
      f_pvalue: null,
      aic: null,
      bic: null,
      rmse: 0.42,
      mae: 0.29,
      n_observations: 100,
      n_train: 80,
      n_test: 20,
      warnings: [],
    });

    renderWithQuery(<RegressionPlatform />);

    fireEvent.click(screen.getByRole("button", { name: "Decision Tree" }));
    fireEvent.change(screen.getByLabelText("Dependent Variable"), { target: { value: "target" } });
    fireEvent.click(screen.getByLabelText("x1"));
    fireEvent.click(screen.getByLabelText("x2"));
    fireEvent.click(screen.getByRole("button", { name: "Fit Model" }));

    expect(await screen.findByText("Feature Importances")).toBeTruthy();
    expect(screen.getAllByText("x1").length).toBeGreaterThan(0);
    expect(screen.getByText("Model Comparison")).toBeTruthy();
    expect(screen.getByText("decision_tree")).toBeTruthy();
    expect(comparisonRefetch).toHaveBeenCalled();
  });

  it("sends alpha, l1_ratio, and polynomial_degree for elastic net fits", async () => {
    checkMissingMutateAsync.mockResolvedValue({
      has_missing: false,
      columns_with_missing: [],
      total_rows_affected: 0,
      recommendation: "",
    });

    fitMutateAsync.mockResolvedValue({
      model_id: "model_2",
      model_type: "elastic_net",
      dependent: "target",
      independents: ["x1"],
      coefficients: [
        {
          variable: "const",
          coefficient: 1.05,
          std_error: null,
          t_stat: null,
          z_stat: null,
          p_value: null,
          ci_lower: null,
          ci_upper: null,
        },
      ],
      r_squared: 0.81,
      adj_r_squared: null,
      f_statistic: null,
      f_pvalue: null,
      aic: null,
      bic: null,
      rmse: 0.31,
      mae: 0.25,
      n_observations: 100,
      n_train: 100,
      n_test: null,
      warnings: [],
    });

    renderWithQuery(<RegressionPlatform />);

    fireEvent.click(screen.getByRole("button", { name: "ElasticNet" }));
    fireEvent.change(screen.getByLabelText("Dependent Variable"), { target: { value: "target" } });
    fireEvent.click(screen.getByLabelText("x1"));
    fireEvent.change(screen.getByLabelText("Alpha"), { target: { value: "0.25" } });
    fireEvent.change(screen.getByLabelText("L1 Ratio"), { target: { value: "0.7" } });
    fireEvent.change(screen.getByLabelText("Polynomial Degree"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Fit Model" }));

    await screen.findByText("Coefficients");
    expect(checkMissingMutateAsync).toHaveBeenCalledWith({
      dependent: "target",
      independents: ["x1"],
    });
    expect(fitMutateAsync).toHaveBeenCalledWith({
      model_type: "elastic_net",
      dependent: "target",
      independents: ["x1"],
      interaction_terms: [],
      train_test_split: 1,
      missing_strategy: "listwise",
      alpha: 0.25,
      l1_ratio: 0.7,
      polynomial_degree: 3,
      max_depth: null,
      n_estimators: 100,
      learning_rate: 0.1,
    });
  });

  it("sends max_depth and n_estimators for random forest fits", async () => {
    checkMissingMutateAsync.mockResolvedValue({
      has_missing: false,
      columns_with_missing: [],
      total_rows_affected: 0,
      recommendation: "",
    });

    fitMutateAsync.mockResolvedValue({
      model_id: "model_rf_1",
      model_type: "random_forest",
      dependent: "target",
      independents: ["x1"],
      coefficients: [],
      feature_importances: [{ feature: "x1", importance: 1 }],
      r_squared: 0.88,
      adj_r_squared: null,
      f_statistic: null,
      f_pvalue: null,
      aic: null,
      bic: null,
      rmse: 0.2,
      mae: 0.16,
      n_observations: 100,
      n_train: 100,
      n_test: null,
      warnings: [],
    });

    renderWithQuery(<RegressionPlatform />);

    fireEvent.click(screen.getByRole("button", { name: "Random Forest" }));
    fireEvent.change(screen.getByLabelText("Dependent Variable"), { target: { value: "target" } });
    fireEvent.click(screen.getByLabelText("x1"));
    fireEvent.change(screen.getByLabelText("Max Depth"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Number of Trees"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Fit Model" }));

    await screen.findByText("Model Summary");
    expect(fitMutateAsync).toHaveBeenCalledWith({
      model_type: "random_forest",
      dependent: "target",
      independents: ["x1"],
      interaction_terms: [],
      train_test_split: 1,
      missing_strategy: "listwise",
      alpha: 1,
      l1_ratio: 0.5,
      polynomial_degree: 1,
      max_depth: 4,
      n_estimators: 25,
      learning_rate: 0.1,
    });
  });

  it("sends learning_rate for gradient boosting fits", async () => {
    checkMissingMutateAsync.mockResolvedValue({
      has_missing: false,
      columns_with_missing: [],
      total_rows_affected: 0,
      recommendation: "",
    });

    fitMutateAsync.mockResolvedValue({
      model_id: "model_gb_1",
      model_type: "gradient_boosting",
      dependent: "target",
      independents: ["x1"],
      coefficients: [],
      feature_importances: [{ feature: "x1", importance: 1 }],
      r_squared: 0.88,
      adj_r_squared: null,
      f_statistic: null,
      f_pvalue: null,
      aic: null,
      bic: null,
      rmse: 0.2,
      mae: 0.16,
      n_observations: 100,
      n_train: 100,
      n_test: null,
      warnings: [],
    });

    renderWithQuery(<RegressionPlatform />);

    fireEvent.click(screen.getByRole("button", { name: "Gradient Boost" }));
    fireEvent.change(screen.getByLabelText("Dependent Variable"), { target: { value: "target" } });
    fireEvent.click(screen.getByLabelText("x1"));
    fireEvent.change(screen.getByLabelText("Max Depth"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Number of Trees"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("Learning Rate"), { target: { value: "0.2" } });
    fireEvent.click(screen.getByRole("button", { name: "Fit Model" }));

    await screen.findByText("Model Summary");
    expect(fitMutateAsync).toHaveBeenCalledWith({
      model_type: "gradient_boosting",
      dependent: "target",
      independents: ["x1"],
      interaction_terms: [],
      train_test_split: 1,
      missing_strategy: "listwise",
      alpha: 1,
      l1_ratio: 0.5,
      polynomial_degree: 1,
      max_depth: 3,
      n_estimators: 40,
      learning_rate: 0.2,
    });
  });

  it("adds interaction terms and includes them in the fit payload", async () => {
    checkMissingMutateAsync.mockResolvedValue({
      has_missing: false,
      columns_with_missing: [],
      total_rows_affected: 0,
      recommendation: "",
    });

    fitMutateAsync.mockResolvedValue({
      model_id: "model_interactions_1",
      model_type: "ols",
      dependent: "target",
      independents: ["x1", "x2"],
      coefficients: [],
      feature_importances: null,
      r_squared: 0.9,
      adj_r_squared: 0.88,
      f_statistic: 20,
      f_pvalue: 0.001,
      aic: 110,
      bic: 120,
      rmse: 0.2,
      mae: 0.15,
      n_observations: 100,
      n_train: 100,
      n_test: null,
      warnings: [],
    });

    renderWithQuery(<RegressionPlatform />);

    fireEvent.change(screen.getByLabelText("Dependent Variable"), { target: { value: "target" } });
    fireEvent.click(screen.getByLabelText("x1"));
    fireEvent.click(screen.getByLabelText("x2"));
    fireEvent.change(screen.getByLabelText("Interaction term A"), { target: { value: "x1" } });
    fireEvent.change(screen.getByLabelText("Interaction term B"), { target: { value: "x2" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Interaction Term" }));

    expect(screen.getByText("x1 × x2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Fit Model" }));

    await screen.findByText("Model Summary");
    expect(fitMutateAsync).toHaveBeenCalledWith({
      model_type: "ols",
      dependent: "target",
      independents: ["x1", "x2"],
      interaction_terms: [["x1", "x2"]],
      train_test_split: 1,
      missing_strategy: "listwise",
      alpha: 1,
      l1_ratio: 0.5,
      polynomial_degree: 1,
      max_depth: null,
      n_estimators: 100,
      learning_rate: 0.1,
    });
  });

  it("renders VIF diagnostics after a model is fitted", () => {
    vifQueryState = {
      data: {
        entries: [
          { feature: "x1", vif: 3.2, is_high: false },
          { feature: "x2", vif: 12.4, is_high: true },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };

    useRegressionStore.getState().setResult({
      model_id: "model_vif_1",
      model_type: "ols",
      dependent: "target",
      independents: ["x1", "x2"],
      coefficients: [],
      feature_importances: null,
      r_squared: 0.9,
      adj_r_squared: 0.88,
      f_statistic: 20,
      f_pvalue: 0.001,
      aic: 110,
      bic: 120,
      rmse: 0.2,
      mae: 0.15,
      n_observations: 100,
      n_train: 100,
      n_test: null,
      warnings: [],
    });

    renderWithQuery(<RegressionPlatform />);

    expect(screen.getByText("VIF Summary")).toBeTruthy();
    expect(screen.getAllByText("x1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("x2").length).toBeGreaterThan(0);
    const highVifCell = screen.getByText("12.40");
    expect(highVifCell.className).toContain("text-red");
  });

  it("renders confusion matrix and ROC for non-logistic classifiers", () => {
    useRegressionStore.getState().setResult({
      model_id: "model_classifier_1",
      model_type: "gradient_boosting_classifier",
      dependent: "target",
      independents: ["x1"],
      coefficients: [],
      feature_importances: [{ feature: "x1", importance: 1 }],
      r_squared: null,
      adj_r_squared: null,
      f_statistic: null,
      f_pvalue: null,
      aic: null,
      bic: null,
      rmse: null,
      mae: null,
      n_observations: 100,
      n_train: 80,
      n_test: 20,
      warnings: [],
    });

    renderWithQuery(<RegressionPlatform />);

    expect(screen.getByText("Confusion Matrix")).toBeTruthy();
    expect(screen.getByText("ROC Curve")).toBeTruthy();
  });

  it("shows blocking validation warnings before fit", async () => {
    dataValidationMutateAsync.mockResolvedValue({
      can_proceed: false,
      warnings: [
        {
          column: "x1",
          warning_type: "zero_variance",
          message: "Column 'x1' has zero variance (only one unique value).",
          severity: "warning",
        },
      ],
    });

    renderWithQuery(<RegressionPlatform />);

    fireEvent.change(screen.getByLabelText("Dependent Variable"), { target: { value: "target" } });
    fireEvent.click(screen.getByLabelText("x1"));
    fireEvent.click(screen.getByRole("button", { name: "Fit Model" }));

    expect(await screen.findByText("Column 'x1' has zero variance (only one unique value).", { exact: false })).toBeTruthy();
    expect(fitMutateAsync).not.toHaveBeenCalled();
  });

  it("clears stale fitted results when validation blocks a new fit", async () => {
    useRegressionStore.getState().setResult({
      model_id: "model_existing",
      model_type: "ols",
      dependent: "target",
      independents: ["x1"],
      coefficients: [
        {
          variable: "const",
          coefficient: 1.23,
          std_error: 0.2,
          t_stat: 6.15,
          z_stat: null,
          p_value: 0.01,
          ci_lower: 0.8,
          ci_upper: 1.6,
        },
      ],
      feature_importances: null,
      r_squared: 0.88,
      adj_r_squared: 0.86,
      f_statistic: 12.4,
      f_pvalue: 0.001,
      aic: 120.4,
      bic: 130.6,
      rmse: 0.22,
      mae: 0.18,
      n_observations: 100,
      n_train: 100,
      n_test: null,
      warnings: [],
    });
    useRegressionStore.getState().setCvResult({
      model_type: "ols",
      k: 4,
      scoring: "r2",
      fold_scores: [0.91, 0.89, 0.88, 0.9],
      mean_score: 0.895,
      std_score: 0.011,
      warnings: [],
    });

    dataValidationMutateAsync.mockResolvedValue({
      can_proceed: false,
      warnings: [
        {
          column: "x1",
          warning_type: "zero_variance",
          message: "Column 'x1' has zero variance (only one unique value).",
          severity: "warning",
        },
      ],
    });

    renderWithQuery(<RegressionPlatform />);

    expect(screen.getByText("Coefficients")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Dependent Variable"), { target: { value: "target" } });
    fireEvent.click(screen.getByLabelText("x1"));
    fireEvent.click(screen.getByRole("button", { name: "Fit Model" }));

    expect(await screen.findByText("Column 'x1' has zero variance (only one unique value).", { exact: false })).toBeTruthy();
    expect(screen.queryByText("Coefficients")).toBeNull();
    expect(screen.getByText(/Configure variables and click/i)).toBeTruthy();
    expect(useRegressionStore.getState().lastResult).toBeNull();
    expect(useRegressionStore.getState().isModelFitted).toBe(false);
    expect(useRegressionStore.getState().cvResult).toBeNull();
  });

  it("dismisses individual validation warnings", async () => {
    dataValidationMutateAsync.mockResolvedValue({
      can_proceed: false,
      warnings: [
        {
          column: "x1",
          warning_type: "zero_variance",
          message: "Column 'x1' has zero variance (only one unique value).",
          severity: "warning",
        },
        {
          column: "x2",
          warning_type: "high_missing",
          message: "Column 'x2' has more than 30% missing values.",
          severity: "info",
        },
      ],
    });

    renderWithQuery(<RegressionPlatform />);

    fireEvent.change(screen.getByLabelText("Dependent Variable"), { target: { value: "target" } });
    fireEvent.click(screen.getByLabelText("x1"));
    fireEvent.click(screen.getByLabelText("x2"));
    fireEvent.click(screen.getByRole("button", { name: "Fit Model" }));

    expect(await screen.findByText("Column 'x1' has zero variance (only one unique value).", { exact: false })).toBeTruthy();
    expect(screen.getByText("Column 'x2' has more than 30% missing values.", { exact: false })).toBeTruthy();

    const dismissButtons = screen.getAllByRole("button", { name: "×" });
    fireEvent.click(dismissButtons[0]);

    expect(screen.queryByText("Column 'x1' has zero variance (only one unique value).", { exact: false })).toBeNull();
    expect(screen.getByText("Column 'x2' has more than 30% missing values.", { exact: false })).toBeTruthy();
  });

  it("runs cross-validation when enabled and renders the summary", async () => {
    dataValidationMutateAsync.mockResolvedValue({
      can_proceed: true,
      warnings: [],
    });
    checkMissingMutateAsync.mockResolvedValue({
      has_missing: false,
      columns_with_missing: [],
      total_rows_affected: 0,
      recommendation: "",
    });
    fitMutateAsync.mockResolvedValue({
      model_id: "model_cv_1",
      model_type: "ols",
      dependent: "target",
      independents: ["x1"],
      coefficients: [
        {
          variable: "const",
          coefficient: 1,
          std_error: 0.1,
          t_stat: 10,
          z_stat: null,
          p_value: 0.001,
          ci_lower: 0.8,
          ci_upper: 1.2,
        },
      ],
      feature_importances: null,
      r_squared: 0.9,
      adj_r_squared: 0.89,
      f_statistic: 25,
      f_pvalue: 0.001,
      aic: 100,
      bic: 110,
      rmse: 0.2,
      mae: 0.1,
      n_observations: 100,
      n_train: 100,
      n_test: null,
      warnings: [],
    });
    crossValidationMutateAsync.mockResolvedValue({
      model_type: "ols",
      k: 4,
      scoring: "r2",
      fold_scores: [0.91, 0.89, 0.88, 0.9],
      mean_score: 0.895,
      std_score: 0.011,
      warnings: [],
    });

    renderWithQuery(<RegressionPlatform />);

    fireEvent.change(screen.getByLabelText("Dependent Variable"), { target: { value: "target" } });
    fireEvent.click(screen.getByLabelText("x1"));
    fireEvent.click(screen.getByLabelText("Cross-Validation"));
    fireEvent.change(screen.getByLabelText("Number of folds (k)"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Fit Model" }));

    expect(await screen.findByText("Cross-Validation (4-fold, r2)")).toBeTruthy();
    expect(crossValidationMutateAsync).toHaveBeenCalledWith({
      model_type: "ols",
      dependent: "target",
      independents: ["x1"],
      k: 4,
      scoring: "r2",
      missing_strategy: "listwise",
      alpha: 1,
      l1_ratio: 0.5,
      polynomial_degree: 1,
      max_depth: null,
      n_estimators: 100,
      learning_rate: 0.1,
    });
  });

  it("shows classifier accuracy and f1 from the fit result even before confusion data loads", () => {
    useRegressionStore.getState().setResult({
      model_id: "model_classifier_metrics",
      model_type: "gradient_boosting_classifier",
      dependent: "target",
      independents: ["x1"],
      coefficients: [],
      feature_importances: [{ feature: "x1", importance: 1 }],
      r_squared: null,
      adj_r_squared: null,
      f_statistic: null,
      f_pvalue: null,
      aic: null,
      bic: null,
      rmse: null,
      mae: null,
      accuracy: 0.92,
      f1: 0.89,
      n_observations: 100,
      n_train: 80,
      n_test: 20,
      warnings: [],
    });

    renderWithQuery(<RegressionPlatform />);

    expect(screen.getByText("Accuracy")).toBeTruthy();
    expect(screen.getByText("0.92")).toBeTruthy();
    expect(screen.getByText("F1")).toBeTruthy();
    expect(screen.getByText("0.89")).toBeTruthy();
  });

  it("shows prediction and diagnostics tabs when a model is fitted", () => {
    useRegressionStore.getState().setResult({
      model_id: "model_with_tabs",
      model_type: "ridge",
      dependent: "target",
      independents: ["x1", "x2"],
      coefficients: [],
      feature_importances: null,
      r_squared: 0.91,
      adj_r_squared: null,
      f_statistic: null,
      f_pvalue: null,
      aic: null,
      bic: null,
      rmse: 0.2,
      mae: 0.1,
      n_observations: 100,
      n_train: 80,
      n_test: 20,
      warnings: [],
    });

    renderWithQuery(<RegressionPlatform />);

    expect(screen.getByRole("button", { name: "Prediction" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Diagnostics" })).toBeTruthy();
  });

  it("hides prediction and diagnostics tabs before any model is fitted", () => {
    renderWithQuery(<RegressionPlatform />);

    expect(screen.queryByRole("button", { name: "Prediction" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Diagnostics" })).toBeNull();
  });

  it("renders the selected prediction and diagnostics panels", () => {
    useRegressionStore.getState().setResult({
      model_id: "model_with_panel_switch",
      model_type: "random_forest",
      dependent: "target",
      independents: ["x1", "x2"],
      coefficients: [],
      feature_importances: [{ feature: "x1", importance: 0.6 }],
      r_squared: 0.84,
      adj_r_squared: null,
      f_statistic: null,
      f_pvalue: null,
      aic: null,
      bic: null,
      rmse: 0.3,
      mae: 0.2,
      n_observations: 100,
      n_train: 80,
      n_test: 20,
      warnings: [],
    });

    renderWithQuery(<RegressionPlatform />);

    fireEvent.click(screen.getByRole("button", { name: "Prediction" }));
    expect(screen.getByText("Prediction Panel")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Diagnostics" }));
    expect(screen.getByText("Extended Diagnostics")).toBeTruthy();
  });
});
