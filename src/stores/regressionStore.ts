import { create } from "zustand";
import type { RegressionResponse } from "@/types/regression";

interface RegressionState {
  modelType: "ols" | "logistic";
  dependent: string | null;
  independents: string[];
  trainTestSplit: number;
  missingStrategy: "listwise" | "mean_imputation";
  lastResult: RegressionResponse | null;
  isModelFitted: boolean;

  setModelType: (type: "ols" | "logistic") => void;
  setDependent: (col: string | null) => void;
  addIndependent: (col: string) => void;
  removeIndependent: (col: string) => void;
  setTrainTestSplit: (value: number) => void;
  setMissingStrategy: (strategy: "listwise" | "mean_imputation") => void;
  hydrateRegression: (config: {
    modelType: "ols" | "logistic";
    dependent: string | null;
    independents: string[];
    trainTestSplit: number;
    missingStrategy: "listwise" | "mean_imputation";
  }) => void;
  setResult: (result: RegressionResponse) => void;
  reset: () => void;
}

const initialState = {
  modelType: "ols" as const,
  dependent: null,
  independents: [] as string[],
  trainTestSplit: 1,
  missingStrategy: "listwise" as const,
  lastResult: null,
  isModelFitted: false,
};

export const useRegressionStore = create<RegressionState>((set, get) => ({
  ...initialState,
  setModelType: (type) => set({ modelType: type }),
  setDependent: (col) =>
    set((state) => ({
      dependent: col,
      independents: col ? state.independents.filter((value) => value !== col) : state.independents,
    })),
  addIndependent: (col) => {
    const { dependent, independents } = get();

    if (col === dependent || independents.includes(col)) {
      return;
    }

    set({ independents: [...independents, col] });
  },
  removeIndependent: (col) =>
    set((state) => ({
      independents: state.independents.filter((value) => value !== col),
    })),
  setTrainTestSplit: (value) => set({ trainTestSplit: value }),
  setMissingStrategy: (strategy) => set({ missingStrategy: strategy }),
  hydrateRegression: (config) =>
    set({
      modelType: config.modelType,
      dependent: config.dependent,
      independents: [...config.independents],
      trainTestSplit: config.trainTestSplit,
      missingStrategy: config.missingStrategy,
      lastResult: null,
      isModelFitted: false,
    }),
  setResult: (result) =>
    set({
      lastResult: result,
      isModelFitted: true,
    }),
  reset: () => set({ ...initialState }),
}));
