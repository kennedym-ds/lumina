import { create } from "zustand";
import type {
  CrossValidationResponse,
  DataValidationWarning,
  ModelComparisonEntry,
  RegressionMissingStrategy,
  RegressionModelType,
  RegressionResponse,
} from "@/types/regression";

interface RegressionState {
  modelType: RegressionModelType;
  dependent: string | null;
  independents: string[];
  interactionTerms: string[][];
  trainTestSplit: number;
  missingStrategy: RegressionMissingStrategy;
  alpha: number;
  l1Ratio: number;
  polynomialDegree: number;
  maxDepth: number | null;
  nEstimators: number;
  learningRate: number;
  cvEnabled: boolean;
  cvFolds: number;
  cvResult: CrossValidationResponse | null;
  validationWarnings: DataValidationWarning[];
  lastResult: RegressionResponse | null;
  isModelFitted: boolean;
  modelBlob: string | null;
  modelHistory: ModelComparisonEntry[];

  setModelType: (type: RegressionModelType) => void;
  setDependent: (col: string | null) => void;
  addIndependent: (col: string) => void;
  removeIndependent: (col: string) => void;
  setInteractionTerms: (terms: string[][]) => void;
  setTrainTestSplit: (value: number) => void;
  setMissingStrategy: (strategy: RegressionMissingStrategy) => void;
  setAlpha: (value: number) => void;
  setL1Ratio: (value: number) => void;
  setPolynomialDegree: (value: number) => void;
  setMaxDepth: (value: number | null) => void;
  setNEstimators: (value: number) => void;
  setLearningRate: (value: number) => void;
  setCvEnabled: (value: boolean) => void;
  setCvFolds: (value: number) => void;
  setCvResult: (result: CrossValidationResponse | null) => void;
  setValidationWarnings: (warnings: DataValidationWarning[]) => void;
  hydrateRegression: (config: {
    modelType: RegressionModelType;
    dependent: string | null;
    independents: string[];
    interactionTerms?: string[][];
    trainTestSplit: number;
    missingStrategy: RegressionMissingStrategy;
    alpha: number;
    l1Ratio: number;
    polynomialDegree: number;
    maxDepth: number | null;
    nEstimators: number;
    learningRate: number;
    modelBlob?: string | null;
    modelResult?: RegressionResponse | null;
    modelHistory?: ModelComparisonEntry[];
  }) => void;
  setResult: (result: RegressionResponse) => void;
  clearResult: () => void;
  reset: () => void;
}

function sanitizeInteractionTerms(
  terms: string[][],
  dependent: string | null,
  independents: string[],
): string[][] {
  const independentSet = new Set(independents);
  const seen = new Set<string>();

  return terms.reduce<string[][]>((accumulator, term) => {
    if (term.length !== 2) {
      return accumulator;
    }

    const [rawLeft, rawRight] = term;
    if (!rawLeft || !rawRight || rawLeft === rawRight) {
      return accumulator;
    }

    if (rawLeft === dependent || rawRight === dependent) {
      return accumulator;
    }

    if (!independentSet.has(rawLeft) || !independentSet.has(rawRight)) {
      return accumulator;
    }

    const normalized = [rawLeft, rawRight].sort((left, right) => left.localeCompare(right));
    const key = normalized.join("::");
    if (seen.has(key)) {
      return accumulator;
    }

    seen.add(key);
    accumulator.push(normalized);
    return accumulator;
  }, []);
}

const initialState = {
  modelType: "ols" as const,
  dependent: null,
  independents: [] as string[],
  interactionTerms: [] as string[][],
  trainTestSplit: 1,
  missingStrategy: "listwise" as const,
  alpha: 1,
  l1Ratio: 0.5,
  polynomialDegree: 1,
  maxDepth: null as number | null,
  nEstimators: 100,
  learningRate: 0.1,
  cvEnabled: false,
  cvFolds: 5,
  cvResult: null,
  validationWarnings: [] as DataValidationWarning[],
  lastResult: null,
  isModelFitted: false,
  modelBlob: null as string | null,
  modelHistory: [] as ModelComparisonEntry[],
};

export const useRegressionStore = create<RegressionState>((set, get) => ({
  ...initialState,
  setModelType: (type) => set({ modelType: type }),
  setDependent: (col) =>
    set((state) => {
      const nextIndependents = col ? state.independents.filter((value) => value !== col) : state.independents;

      return {
        dependent: col,
        independents: nextIndependents,
        interactionTerms: sanitizeInteractionTerms(state.interactionTerms, col, nextIndependents),
      };
    }),
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
      interactionTerms: state.interactionTerms.filter((term) => !term.includes(col)),
    })),
  setInteractionTerms: (terms) => {
    const { dependent, independents } = get();

    set({ interactionTerms: sanitizeInteractionTerms(terms, dependent, independents) });
  },
  setTrainTestSplit: (value) => set({ trainTestSplit: value }),
  setMissingStrategy: (strategy) => set({ missingStrategy: strategy }),
  setAlpha: (value) => set({ alpha: value }),
  setL1Ratio: (value) => set({ l1Ratio: value }),
  setPolynomialDegree: (value) => set({ polynomialDegree: value }),
  setMaxDepth: (value) => set({ maxDepth: value }),
  setNEstimators: (value) => set({ nEstimators: value }),
  setLearningRate: (value) => set({ learningRate: value }),
  setCvEnabled: (value) => set({ cvEnabled: value }),
  setCvFolds: (value) => set({ cvFolds: value }),
  setCvResult: (result) => set({ cvResult: result }),
  setValidationWarnings: (warnings) => set({ validationWarnings: warnings }),
  hydrateRegression: (config) =>
    set({
      modelType: config.modelType,
      dependent: config.dependent,
      independents: [...config.independents],
      interactionTerms: sanitizeInteractionTerms(
        config.interactionTerms ?? [],
        config.dependent,
        config.independents,
      ),
      trainTestSplit: config.trainTestSplit,
      missingStrategy: config.missingStrategy,
      alpha: config.alpha,
      l1Ratio: config.l1Ratio,
      polynomialDegree: config.polynomialDegree,
      maxDepth: config.maxDepth,
      nEstimators: config.nEstimators,
      learningRate: config.learningRate,
      cvEnabled: false,
      cvFolds: 5,
      cvResult: null,
      validationWarnings: [],
      lastResult: config.modelResult ?? null,
      isModelFitted: config.modelResult != null,
      modelBlob: config.modelBlob ?? null,
      modelHistory: config.modelHistory ?? [],
    }),
  setResult: (result) =>
    set({
      lastResult: result,
      isModelFitted: true,
      modelBlob: null,
    }),
  clearResult: () =>
    set({
      cvResult: null,
      lastResult: null,
      isModelFitted: false,
      modelBlob: null,
      modelHistory: [],
    }),
  reset: () => set({ ...initialState }),
}));
