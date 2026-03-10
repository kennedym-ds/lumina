import { beforeEach, describe, expect, it } from "vitest";
import { serializeProject } from "@/services/projectSerializer";
import { useChartStore } from "@/stores/chartStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";
import { useDatasetStore } from "@/stores/datasetStore";
import { useRegressionStore } from "@/stores/regressionStore";

describe("projectSerializer", () => {
  beforeEach(() => {
    useDatasetStore.getState().clearDataset();
    useChartStore.getState().clearCharts();
    useCrossFilterStore.getState().clearSelection();
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
    });

    useChartStore.getState().hydrateCharts(
      [
        {
          chartId: "chart-1",
          chartType: "scatter",
          x: "x1",
          y: "y",
          color: "group",
          facet: null,
        },
      ],
      "chart-1",
    );

    useRegressionStore.getState().hydrateRegression({
      modelType: "ols",
      dependent: "y",
      independents: ["x1", "x2"],
      trainTestSplit: 0.8,
      missingStrategy: "mean_imputation",
    });

    useCrossFilterStore.getState().setSelection("chart-1", [2, 1]);

    const serialized = serializeProject();

    expect(serialized).not.toBeNull();
    expect(serialized?.file_path).toBe("C:\\data\\sample.csv");
    expect(serialized?.charts).toHaveLength(1);
    expect(serialized?.charts[0]).toMatchObject({
      chart_id: "chart-1",
      chart_type: "scatter",
      x: "x1",
      y: "y",
      color: "group",
    });
    expect(serialized?.regression).toMatchObject({
      model_type: "ols",
      dependent: "y",
      independents: ["x1", "x2"],
      train_test_split: 0.8,
      missing_strategy: "mean_imputation",
    });
    expect(serialized?.cross_filter).toEqual({
      selected_indices: [1, 2],
      selection_source: "chart-1",
    });
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
    });

    useChartStore.getState().hydrateCharts([], null);

    const serialized = serializeProject();
    expect(serialized?.cross_filter).toBeNull();
  });
});