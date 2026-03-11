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
  TTestRequest,
  TTestResponse,
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
