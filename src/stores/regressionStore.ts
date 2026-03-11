import { create } from "zustand";
import type {
  RegressionMissingStrategy,
  RegressionModelType,
  RegressionResponse,
} from "@/types/regression";

interface RegressionState {
  modelType: RegressionModelType;
  dependent: string | null;
  independents: string[];
  trainTestSplit: number;
  missingStrategy: RegressionMissingStrategy;
  alpha: number;
  l1Ratio: number;
  polynomialDegree: number;
  maxDepth: number | null;
  nEstimators: number;
  lastResult: RegressionResponse | null;
  isModelFitted: boolean;

  setModelType: (type: RegressionModelType) => void;
  setDependent: (col: string | null) => void;
  addIndependent: (col: string) => void;
  removeIndependent: (col: string) => void;
  setTrainTestSplit: (value: number) => void;
  setMissingStrategy: (strategy: RegressionMissingStrategy) => void;
  setAlpha: (value: number) => void;
  setL1Ratio: (value: number) => void;
  setPolynomialDegree: (value: number) => void;
  setMaxDepth: (value: number | null) => void;
  setNEstimators: (value: number) => void;
  hydrateRegression: (config: {
    modelType: RegressionModelType;
    dependent: string | null;
    independents: string[];
    trainTestSplit: number;
    missingStrategy: RegressionMissingStrategy;
    alpha: number;
    l1Ratio: number;
    polynomialDegree: number;
    maxDepth: number | null;
    nEstimators: number;
  }) => void;
  setResult: (result: RegressionResponse) => void;
  clearResult: () => void;
  reset: () => void;
}

const initialState = {
  modelType: "ols" as const,
  dependent: null,
  independents: [] as string[],
  trainTestSplit: 1,
  missingStrategy: "listwise" as const,
  alpha: 1,
  l1Ratio: 0.5,
  polynomialDegree: 1,
  maxDepth: null as number | null,
  nEstimators: 100,
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
  setAlpha: (value) => set({ alpha: value }),
  setL1Ratio: (value) => set({ l1Ratio: value }),
  setPolynomialDegree: (value) => set({ polynomialDegree: value }),
  setMaxDepth: (value) => set({ maxDepth: value }),
  setNEstimators: (value) => set({ nEstimators: value }),
  hydrateRegression: (config) =>
    set({
      modelType: config.modelType,
      dependent: config.dependent,
      independents: [...config.independents],
      trainTestSplit: config.trainTestSplit,
      missingStrategy: config.missingStrategy,
      alpha: config.alpha,
      l1Ratio: config.l1Ratio,
      polynomialDegree: config.polynomialDegree,
      maxDepth: config.maxDepth,
      nEstimators: config.nEstimators,
      lastResult: null,
      isModelFitted: false,
    }),
  setResult: (result) =>
    set({
      lastResult: result,
      isModelFitted: true,
    }),
  clearResult: () =>
    set({
      lastResult: null,
      isModelFitted: false,
    }),
  reset: () => set({ ...initialState }),
}));
