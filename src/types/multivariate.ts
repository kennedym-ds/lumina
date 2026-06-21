export interface PCARequest {
  columns: string[];
  n_components?: number | null;
}

export interface LoadingRow {
  feature: string;
  values: number[];
}

export interface PCAResponse {
  components: number;
  feature_names: string[];
  explained_variance_ratio: number[];
  cumulative_variance: number[];
  loadings: LoadingRow[];
  scores_pc1: number[];
  scores_pc2: number[];
  scores_pc3: number[];
  n_observations: number;
}

export interface ClusterRequest {
  columns: string[];
  n_clusters: number;
}

export interface ClusterResponse {
  labels: number[];
  x: number[];
  y: number[];
  cluster_sizes: number[];
  inertia: number;
  silhouette: number | null;
  n_observations: number;
}
