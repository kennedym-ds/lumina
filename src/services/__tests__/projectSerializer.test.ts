import { beforeEach, describe, expect, it } from "vitest";
import { serializeProject } from "@/services/projectSerializer";
import { useChartStore } from "@/stores/chartStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useDatasetStore } from "@/stores/datasetStore";
import { useRegressionStore } from "@/stores/regressionStore";

describe("projectSerializer", () => {
  beforeEach(() => {
    useDatasetStore.getState().clearDataset();
    useChartStore.getState().clearCharts();
    useCrossFilterStore.getState().clearSelection();
    useDashboardStore.getState().clearDashboard();
    useRegressionStore.getState().reset();
  });

  it("serializes empty state to null", () => {
    expect(serializeProject()).toBeNull();
  });

  it("serializes full state", () => {
    useDatasetStore.getState().hydrate({
      datasetId: "ds_1",
      fileName: "sample.csv",
      fileFormat: "csv",
      columns: [],
      rowCount: 100,
      columnCount: 3,
      filePath: "C:\\data\\sample.csv",
      sheetName: "Sheet2",
      excludedColumns: ["category"],
    });

    useChartStore.getState().hydrateCharts(
      [
        {
          chartId: "chart-1",
          chartType: "heatmap",
          x: "x1",
          y: "y",
          color: null,
          facet: null,
          aggregation: "mean",
          values: "x2",
        },
      ],
      "chart-1",
    );

    useRegressionStore.getState().hydrateRegression({
      modelType: "ridge",
      dependent: "y",
      independents: ["x1", "x2"],
      trainTestSplit: 0.8,
      missingStrategy: "mean_imputation",
      alpha: 0.15,
      l1Ratio: 0.6,
      polynomialDegree: 4,
      maxDepth: 5,
      nEstimators: 150,
      learningRate: 0.15,
      interactionTerms: [["x1", "x2"]],
      modelBlob: "persisted-model-blob",
    });

    useCrossFilterStore.getState().setSelection("chart-1", [2, 1]);
    useDashboardStore.getState().hydrate([
      {
        id: "panel-1",
        chartId: "chart-1",
        x: 0,
        y: 0,
        w: 3,
        h: 2,
      },
    ]);

    const serialized = serializeProject();

    expect(serialized).not.toBeNull();
    expect(serialized?.version).toBe("1.2");
    expect(serialized?.file_path).toBe("C:\\data\\sample.csv");
    expect(serialized?.sheet_name).toBe("Sheet2");
    expect(serialized?.excluded_columns).toEqual(["category"]);
    expect(serialized?.saved_views).toEqual([]);
    expect(serialized?.column_config).toEqual([{ name: "category", excluded: true }]);
    expect(serialized?.charts).toHaveLength(1);
    expect(serialized?.charts[0]).toMatchObject({
      chart_id: "chart-1",
      chart_type: "heatmap",
      x: "x1",
      y: "y",
      aggregation: "mean",
      values: "x2",
    });
    expect(serialized?.regression).toMatchObject({
      model_type: "ridge",
      dependent: "y",
      independents: ["x1", "x2"],
      train_test_split: 0.8,
      missing_strategy: "mean_imputation",
      alpha: 0.15,
      l1_ratio: 0.6,
      polynomial_degree: 4,
      max_depth: 5,
      n_estimators: 150,
      learning_rate: 0.15,
      interaction_terms: [["x1", "x2"]],
      model_blob: "persisted-model-blob",
    });
    expect(serialized?.cross_filter).toEqual({
      selected_indices: [1, 2],
      selection_source: "chart-1",
    });
    expect(serialized?.dashboard_panels).toEqual([
      {
        id: "panel-1",
        chart_id: "chart-1",
        x: 0,
        y: 0,
        w: 3,
        h: 2,
      },
    ]);
  });

  it("omits cross-filter when empty", () => {
    useDatasetStore.getState().hydrate({
      datasetId: "ds_2",
      fileName: "dataset.csv",
      fileFormat: "csv",
      columns: [],
      rowCount: 10,
      columnCount: 2,
      filePath: "C:\\data\\dataset.csv",
      sheetName: null,
    });

    useChartStore.getState().hydrateCharts([], null);

    const serialized = serializeProject();
    expect(serialized?.cross_filter).toBeNull();
    expect(serialized?.dashboard_panels).toEqual([]);
  });

  it("remains backward compatible when no model blob is present", () => {
    useDatasetStore.getState().hydrate({
      datasetId: "ds_3",
      fileName: "legacy.csv",
      fileFormat: "csv",
      columns: [],
      rowCount: 10,
      columnCount: 2,
      filePath: "C:\\data\\legacy.csv",
      sheetName: null,
    });

    useRegressionStore.getState().hydrateRegression({
      modelType: "ols",
      dependent: "y",
      independents: ["x1"],
      trainTestSplit: 1,
      missingStrategy: "listwise",
      alpha: 1,
      l1Ratio: 0.5,
      polynomialDegree: 1,
      maxDepth: null,
      nEstimators: 100,
      learningRate: 0.1,
      interactionTerms: [],
    });

    const serialized = serializeProject();

    expect(serialized?.version).toBe("1.2");
    expect(serialized?.regression).not.toHaveProperty("model_blob");
  });
});