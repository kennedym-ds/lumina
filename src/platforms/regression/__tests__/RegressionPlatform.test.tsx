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

  it("renders config panel with model type buttons", () => {
    renderWithQuery(<RegressionPlatform />);

    expect(screen.getByRole("button", { name: "OLS" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Logistic" })).toBeTruthy();
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
  });
});
