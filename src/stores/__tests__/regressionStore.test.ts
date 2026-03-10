import { beforeEach, describe, expect, it } from "vitest";
import { useRegressionStore } from "@/stores/regressionStore";

describe("regressionStore", () => {
  beforeEach(() => {
    useRegressionStore.getState().reset();
  });

  it("initial state", () => {
    const state = useRegressionStore.getState();

    expect(state.modelType).toBe("ols");
    expect(state.dependent).toBeNull();
    expect(state.independents).toEqual([]);
    expect(state.trainTestSplit).toBe(1);
    expect(state.missingStrategy).toBe("listwise");
    expect(state.lastResult).toBeNull();
    expect(state.isModelFitted).toBe(false);
  });

  it("set and clear dependent", () => {
    useRegressionStore.getState().setDependent("target");
    expect(useRegressionStore.getState().dependent).toBe("target");

    useRegressionStore.getState().setDependent(null);
    expect(useRegressionStore.getState().dependent).toBeNull();
  });

  it("add/remove independents", () => {
    useRegressionStore.getState().addIndependent("x1");
    useRegressionStore.getState().addIndependent("x2");

    expect(useRegressionStore.getState().independents).toEqual(["x1", "x2"]);

    useRegressionStore.getState().removeIndependent("x1");
    expect(useRegressionStore.getState().independents).toEqual(["x2"]);
  });

  it("set result marks model as fitted", () => {
    useRegressionStore.getState().setResult({
      model_id: "model_1",
      model_type: "ols",
      dependent: "target",
      independents: ["x1"],
      coefficients: [],
      r_squared: null,
      adj_r_squared: null,
      f_statistic: null,
      f_pvalue: null,
      aic: null,
      bic: null,
      n_observations: 100,
      n_train: 100,
      n_test: null,
      warnings: [],
    });

    const state = useRegressionStore.getState();
    expect(state.isModelFitted).toBe(true);
    expect(state.lastResult?.model_id).toBe("model_1");
  });

  it("reset clears everything", () => {
    useRegressionStore.getState().setDependent("target");
    useRegressionStore.getState().addIndependent("x1");

    useRegressionStore.getState().reset();

    const state = useRegressionStore.getState();
    expect(state.dependent).toBeNull();
    expect(state.independents).toEqual([]);
    expect(state.lastResult).toBeNull();
    expect(state.isModelFitted).toBe(false);
    expect(state.modelType).toBe("ols");
  });

  it("hydrates regression config", () => {
    useRegressionStore.getState().hydrateRegression({
      modelType: "logistic",
      dependent: "target",
      independents: ["x1", "x2"],
      trainTestSplit: 0.7,
      missingStrategy: "mean_imputation",
    });

    const state = useRegressionStore.getState();
    expect(state.modelType).toBe("logistic");
    expect(state.dependent).toBe("target");
    expect(state.independents).toEqual(["x1", "x2"]);
    expect(state.trainTestSplit).toBe(0.7);
    expect(state.missingStrategy).toBe("mean_imputation");
    expect(state.isModelFitted).toBe(false);
    expect(state.lastResult).toBeNull();
  });
});
