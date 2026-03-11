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
const comparisonRefetch = vi.fn();

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
  useDiagnostics: () => ({ data: null, isLoading: false, isError: false }),
  useConfusionMatrix: () => ({ data: null, isLoading: false, isError: false }),
  useRoc: () => ({ data: null, isLoading: false, isError: false }),
  useModelComparison: () => ({ ...comparisonQueryState, refetch: comparisonRefetch }),
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

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithQuery(ui: ReactNode) {
  return render(<QueryClientProvider client={createClient()}>{ui}</QueryClientProvider>);
}

describe("RegressionPlatform", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    fitMutateAsync.mockReset();
    checkMissingMutateAsync.mockReset();
    comparisonRefetch.mockReset();
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

  it("renders config panel with all seven model type buttons", () => {
    renderWithQuery(<RegressionPlatform />);

    expect(screen.getByRole("button", { name: "OLS" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Logistic" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ridge" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lasso" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ElasticNet" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decision Tree" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Random Forest" })).toBeTruthy();
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

    expect(checkMissingMutateAsync).toHaveBeenCalledWith({
      dependent: "target",
      independents: ["x1"],
    });
    await screen.findByText("Coefficients");
    expect(fitMutateAsync).toHaveBeenCalledWith({
      model_type: "elastic_net",
      dependent: "target",
      independents: ["x1"],
      train_test_split: 1,
      missing_strategy: "listwise",
      alpha: 0.25,
      l1_ratio: 0.7,
      polynomial_degree: 3,
      max_depth: null,
      n_estimators: 100,
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
      train_test_split: 1,
      missing_strategy: "listwise",
      alpha: 1,
      l1_ratio: 0.5,
      polynomial_degree: 1,
      max_depth: 4,
      n_estimators: 25,
    });
  });
});
