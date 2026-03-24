import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type {
  AnovaRequest,
  AnovaResponse,
  BayesianOneSampleRequest,
  BayesianOneSampleResponse,
  BayesianTwoSampleRequest,
  BayesianTwoSampleResponse,
  CIRequest,
  CIResponse,
  ChiSquareRequest,
  ChiSquareResponse,
  FactorialAnovaRequest,
  FactorialAnovaResponse,
  KruskalRequest,
  KruskalResponse,
  MannWhitneyRequest,
  MannWhitneyResponse,
  NormalityRequest,
  NormalityResponse,
  PowerAnalysisRequest,
  PowerAnalysisResponse,
  RepeatedMeasuresAnovaRequest,
  RepeatedMeasuresAnovaResponse,
  TTestRequest,
  TTestResponse,
  TukeyHSDRequest,
  TukeyHSDResponse,
  WilcoxonRequest,
  WilcoxonResponse,
} from "@/types/inference";

export function useRunTTest(datasetId: string | null) {
  return useMutation<TTestResponse, Error, TTestRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/inference/${datasetId}/ttest`, request);
    },
  });
}

export function useRunChiSquare(datasetId: string | null) {
  return useMutation<ChiSquareResponse, Error, ChiSquareRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/inference/${datasetId}/chi_square`, request);
    },
  });
}

export function useRunAnova(datasetId: string | null) {
  return useMutation<AnovaResponse, Error, AnovaRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/inference/${datasetId}/anova`, request);
    },
  });
}

export function useConfidenceInterval(datasetId: string | null) {
  return useMutation<CIResponse, Error, CIRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/inference/${datasetId}/ci`, request);
    },
  });
}

export function useRunNormality(datasetId: string | null) {
  return useMutation<NormalityResponse, Error, NormalityRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/inference/${datasetId}/normality`, request);
    },
  });
}

export function useRunTukeyHsd(datasetId: string | null) {
  return useMutation<TukeyHSDResponse, Error, TukeyHSDRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/inference/${datasetId}/tukey_hsd`, request);
    },
  });
}

export function useRunMannWhitney(datasetId: string | null) {
  return useMutation<MannWhitneyResponse, Error, MannWhitneyRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/inference/${datasetId}/mann_whitney`, request);
    },
  });
}

export function useRunWilcoxon(datasetId: string | null) {
  return useMutation<WilcoxonResponse, Error, WilcoxonRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/inference/${datasetId}/wilcoxon`, request);
    },
  });
}

export function useRunKruskal(datasetId: string | null) {
  return useMutation<KruskalResponse, Error, KruskalRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/inference/${datasetId}/kruskal`, request);
    },
  });
}

export function useBayesianOneSample(datasetId: string | null) {
  return useMutation<BayesianOneSampleResponse, Error, BayesianOneSampleRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/inference/${datasetId}/bayesian/one_sample`, request);
    },
  });
}

export function useBayesianTwoSample(datasetId: string | null) {
  return useMutation<BayesianTwoSampleResponse, Error, BayesianTwoSampleRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/inference/${datasetId}/bayesian/two_sample`, request);
    },
  });
}

export function usePowerAnalysis(datasetId: string | null) {
  return useMutation<PowerAnalysisResponse, Error, PowerAnalysisRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/inference/${datasetId}/power`, request);
    },
  });
}

export function useRunRepeatedMeasuresAnova(datasetId: string | null) {
  return useMutation<RepeatedMeasuresAnovaResponse, Error, RepeatedMeasuresAnovaRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/inference/${datasetId}/repeated_measures_anova`, request);
    },
  });
}

export function useRunFactorialAnova(datasetId: string | null) {
  return useMutation<FactorialAnovaResponse, Error, FactorialAnovaRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/inference/${datasetId}/factorial_anova`, request);
    },
  });
}
