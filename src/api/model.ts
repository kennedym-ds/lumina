import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type {
  BayesianRegressionRequest,
  BayesianRegressionResponse,
  ConfusionMatrixResponse,
  CrossValidationRequest,
  CrossValidationResponse,
  DataValidationRequest,
  DataValidationResponse,
  DiagnosticsResponse,
  ExtendedDiagnosticsResponse,
  MissingCheckRequest,
  MissingValueReport,
  ModelComparisonResponse,
  PredictionRequest,
  PredictionResponse,
  RegressionRequest,
  RegressionResponse,
  RocResponse,
  StepwiseSelectionRequest,
  StepwiseSelectionResponse,
  VIFResponse,
} from "@/types/regression";

export function useFitRegression(datasetId: string | null) {
  return useMutation<RegressionResponse, Error, RegressionRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/model/${datasetId}/regression`, request);
    },
  });
}

export function useDiagnostics(datasetId: string | null, enabled: boolean) {
  return useQuery<DiagnosticsResponse>({
    queryKey: ["diagnostics", datasetId],
    queryFn: () => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.get(`/api/model/${datasetId}/diagnostics`);
    },
    enabled: enabled && !!datasetId,
  });
}

export function useConfusionMatrix(datasetId: string | null, enabled: boolean) {
  return useQuery<ConfusionMatrixResponse>({
    queryKey: ["confusion", datasetId],
    queryFn: () => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.get(`/api/model/${datasetId}/confusion`);
    },
    enabled: enabled && !!datasetId,
  });
}

export function useRoc(datasetId: string | null, enabled: boolean) {
  return useQuery<RocResponse>({
    queryKey: ["roc", datasetId],
    queryFn: () => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.get(`/api/model/${datasetId}/roc`);
    },
    enabled: enabled && !!datasetId,
  });
}

export function useModelComparison(datasetId: string | null, enabled: boolean) {
  return useQuery<ModelComparisonResponse>({
    queryKey: ["model-comparison", datasetId],
    queryFn: () => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.get(`/api/model/${datasetId}/comparison`);
    },
    enabled: enabled && !!datasetId,
  });
}

export function useCheckMissing(datasetId: string | null) {
  return useMutation<MissingValueReport, Error, MissingCheckRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/model/${datasetId}/check-missing`, request);
    },
  });
}

export function useCrossValidation(datasetId: string | null) {
  return useMutation<CrossValidationResponse, Error, CrossValidationRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/model/${datasetId}/cross-validate`, request);
    },
  });
}

export function useDataValidation(datasetId: string | null) {
  return useMutation<DataValidationResponse, Error, DataValidationRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/model/${datasetId}/validate`, request);
    },
  });
}

export function usePredict(datasetId: string | null | undefined) {
  return useMutation<PredictionResponse, Error, PredictionRequest>({
    mutationFn: (payload) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/model/${datasetId}/predict`, payload);
    },
  });
}

export function useExtendedDiagnostics(datasetId: string | null | undefined, modelType?: string) {
  return useQuery<ExtendedDiagnosticsResponse>({
    queryKey: ["extended-diagnostics", datasetId, modelType],
    queryFn: () => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.get(`/api/model/${datasetId}/extended-diagnostics`);
    },
    enabled: !!datasetId,
  });
}

export function useVIF(datasetId: string | null | undefined) {
  return useQuery<VIFResponse>({
    queryKey: ["vif", datasetId],
    queryFn: () => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.get(`/api/model/${datasetId}/vif`);
    },
    enabled: !!datasetId,
  });
}

export function useStepwiseSelection(datasetId: string | null) {
  return useMutation<StepwiseSelectionResponse, Error, StepwiseSelectionRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/model/${datasetId}/stepwise`, request);
    },
  });
}

export function useBayesianRegression(datasetId: string | null) {
  return useMutation<BayesianRegressionResponse, Error, BayesianRegressionRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/model/${datasetId}/bayesian-regression`, request);
    },
  });
}
