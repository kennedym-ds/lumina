// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AppLayout } from "@/components/Layout/AppLayout";
import { useDatasetStore } from "@/stores/datasetStore";

let pluginQueryState = {
  data: {
    charts: [] as string[],
    transforms: [] as string[],
    tests: [] as string[],
  },
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

vi.mock("@/api/plugins", () => ({
  usePlugins: () => pluginQueryState,
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

vi.mock("@/components/Sidebar/FavouritesPanel", () => ({
  FavouritesPanel: () => <div>Favourites Panel</div>,
}));

vi.mock("@/components/Sidebar/VariableList", () => ({
  VariableList: () => <div>Variable List</div>,
}));

vi.mock("@/components/FilterBuilder/FilterBuilder", () => ({
  FilterBuilder: () => <div>Filter Builder</div>,
}));

vi.mock("@/components/TransformBuilder/TransformBuilder", () => ({
  TransformBuilder: () => <div>Transform Builder</div>,
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

vi.mock("@/components/Toolbar/SaveViewButton", () => ({
  SaveViewButton: () => null,
}));

vi.mock("@/components/Toolbar/UndoRedoButtons", () => ({
  UndoRedoButtons: () => null,
}));

vi.mock("@/components/Toolbar/ExportMenu", () => ({
  ExportMenu: () => null,
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

vi.mock("@/platforms/eda/DistributionOverlay", () => ({
  DistributionOverlay: () => <div>Distribution</div>,
}));

vi.mock("@/platforms/inference/InferencePlatform", () => ({
  InferencePlatform: () => <div>Inference</div>,
}));

vi.mock("@/platforms/profiling/ProfilingPlatform", () => ({
  ProfilingPlatform: () => <div>Profiling</div>,
}));

vi.mock("@/platforms/regression/RegressionPlatform", () => ({
  RegressionPlatform: () => <div>Regression</div>,
}));

vi.mock("@/platforms/dashboard/DashboardPlatform", () => ({
  DashboardPlatform: () => <div>Dashboard</div>,
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

describe("AppLayout plugin status", () => {
  beforeEach(() => {
    pluginQueryState = {
      data: { charts: ["custom_chart"], transforms: ["custom_transform"], tests: ["mean_summary"] },
      isLoading: false,
      isError: false,
    };

    useDatasetStore.getState().clearDataset();
    useDatasetStore.getState().setDataset({
      dataset_id: "ds_plugins",
      file_name: "plugins.csv",
      file_format: "csv",
      row_count: 3,
      column_count: 1,
      columns: [{ name: "value", dtype: "numeric", original_dtype: "float64", missing_count: 0, unique_count: 3 }],
    });
  });

  it("shows total loaded plugins in the header", () => {
    renderWithQuery(
      <AppLayout
        onUpload={async () => {
          throw new Error("not used");
        }}
        isUploading={false}
      />,
    );

    expect(screen.getByText("3 plugins loaded")).toBeTruthy();
  });
});
