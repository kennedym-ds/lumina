// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { InferencePlatform } from "@/platforms/inference/InferencePlatform";
import { useDatasetStore } from "@/stores/datasetStore";

const runTTest = vi.fn();
const runChiSquare = vi.fn();
const runAnova = vi.fn();
const runConfidenceInterval = vi.fn();
const runBayesianOneSample = vi.fn();
const runBayesianTwoSample = vi.fn();

vi.mock("@/api/inference", () => ({
  useRunTTest: () => ({ mutateAsync: runTTest, isPending: false, error: null }),
  useRunChiSquare: () => ({ mutateAsync: runChiSquare, isPending: false, error: null }),
  useRunAnova: () => ({ mutateAsync: runAnova, isPending: false, error: null }),
  useConfidenceInterval: () => ({ mutateAsync: runConfidenceInterval, isPending: false, error: null }),
  useBayesianOneSample: () => ({ mutateAsync: runBayesianOneSample, isPending: false, error: null }),
  useBayesianTwoSample: () => ({ mutateAsync: runBayesianTwoSample, isPending: false, error: null }),
}));

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithQuery(ui: ReactNode) {
  return render(<QueryClientProvider client={createClient()}>{ui}</QueryClientProvider>);
}

describe("InferencePlatform", () => {
  beforeEach(() => {
    runTTest.mockReset();
    runChiSquare.mockReset();
    runAnova.mockReset();
    runConfidenceInterval.mockReset();
    runBayesianOneSample.mockReset();
    runBayesianTwoSample.mockReset();
    useDatasetStore.getState().clearDataset();
    useDatasetStore.getState().setDataset({
      dataset_id: "dataset-1",
      file_name: "inference.csv",
      file_format: "csv",
      row_count: 30,
      column_count: 4,
      columns: [
        { name: "score", dtype: "numeric", original_dtype: "float64", missing_count: 0, unique_count: 30 },
        { name: "score_2", dtype: "numeric", original_dtype: "float64", missing_count: 0, unique_count: 30 },
        { name: "group", dtype: "categorical", original_dtype: "object", missing_count: 0, unique_count: 3 },
        { name: "outcome", dtype: "boolean", original_dtype: "bool", missing_count: 0, unique_count: 2 },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders test type selector", () => {
    renderWithQuery(<InferencePlatform />);

    expect(screen.getByRole("button", { name: "T-Test" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chi-Square" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ANOVA" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confidence Interval" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bayesian One-Sample" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bayesian Two-Sample" })).toBeTruthy();
    expect(screen.getByLabelText("T-test type")).toBeTruthy();
    expect(screen.getByLabelText("Value column")).toBeTruthy();
  });

  it("shows the correct form fields for each test type", () => {
    renderWithQuery(<InferencePlatform />);

    fireEvent.click(screen.getByRole("button", { name: "Chi-Square" }));
    expect(screen.getByLabelText("Row column")).toBeTruthy();
    expect(screen.getByLabelText("Column column")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "ANOVA" }));
    expect(screen.getByLabelText("Numeric column")).toBeTruthy();
    expect(screen.getByLabelText("Group column")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confidence Interval" }));
    expect(screen.getByLabelText("Confidence interval column")).toBeTruthy();
    expect(screen.getByLabelText("Confidence level")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Bayesian One-Sample" }));
    expect(screen.getByLabelText("Bayesian sample column")).toBeTruthy();
    expect(screen.getByLabelText("Prior mean")).toBeTruthy();
    expect(screen.getByLabelText("Prior sigma")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Bayesian Two-Sample" }));
    expect(screen.getByLabelText("Bayesian group A column")).toBeTruthy();
    expect(screen.getByLabelText("Bayesian group B column")).toBeTruthy();
    expect(screen.getAllByLabelText("Credible level").length).toBeGreaterThan(0);
  });


  it("renders t-test effect size details after a run", async () => {
    runTTest.mockResolvedValue({
      test_type: "independent",
      statistic: -8.0,
      p_value: 0.0004,
      df: 6,
      mean_a: 11.5,
      mean_b: 21.5,
      n_a: 4,
      n_b: 4,
      alternative: "two-sided",
      ci_lower: -13.06,
      ci_upper: -6.94,
      ci_level: 0.95,
      effect_size: -0.95,
      effect_size_label: "Cohen's d",
    });

    renderWithQuery(<InferencePlatform />);

    fireEvent.change(screen.getByLabelText("Group A label"), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText("Group B label"), { target: { value: "B" } });
    fireEvent.click(screen.getByRole("button", { name: "Run Test" }));

    expect((await screen.findAllByText("Cohen's d")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Large effect")).toBeTruthy();
    expect(await screen.findByText("95% CI of mean difference")).toBeTruthy();
  });


  it("renders the CI results panel", async () => {
    runConfidenceInterval.mockResolvedValue({
      column: "score",
      mean: 10.4,
      ci_lower: 9.0,
      ci_upper: 11.8,
      confidence_level: 0.95,
      n: 5,
      std_error: 0.5,
    });

    renderWithQuery(<InferencePlatform />);

    fireEvent.click(screen.getByRole("button", { name: "Confidence Interval" }));
    fireEvent.click(screen.getByRole("button", { name: "Run Test" }));

    expect(await screen.findByText("Confidence interval summary")).toBeTruthy();
    expect(await screen.findByText("Standard error")).toBeTruthy();
  });


  it("renders chi-square and ANOVA effect size labels when available", async () => {
    runChiSquare.mockResolvedValue({
      statistic: 7.0,
      p_value: 0.01,
      df: 1,
      contingency_table: { yes: { improved: 10, not_improved: 2 }, no: { improved: 3, not_improved: 9 } },
      expected_frequencies: { yes: { improved: 6.5, not_improved: 5.5 }, no: { improved: 6.5, not_improved: 5.5 } },
      cramers_v: 0.54,
      n_total: 24,
    });
    runAnova.mockResolvedValue({
      statistic: 25,
      p_value: 0.0001,
      df_between: 2,
      df_within: 6,
      group_means: { A: 6, B: 11, C: 16 },
      group_sizes: { A: 3, B: 3, C: 3 },
      eta_squared: 0.2,
    });

    renderWithQuery(<InferencePlatform />);

    fireEvent.click(screen.getByRole("button", { name: "Chi-Square" }));
    fireEvent.click(screen.getByRole("button", { name: "Run Test" }));
    expect((await screen.findAllByText("Cramér's V")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "ANOVA" }));
    fireEvent.click(screen.getByRole("button", { name: "Run Test" }));
    expect((await screen.findAllByText("Eta squared")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Large effect")).toBeTruthy();
  });

  it("runs Bayesian one-sample analysis and shows Bayes factor interpretation", async () => {
    runBayesianOneSample.mockResolvedValue({
      posterior_mean: 10.4,
      posterior_std: 0.63,
      ci_lower: 9.17,
      ci_upper: 11.63,
      credible_level: 0.95,
      bayes_factor_10: 12.4,
      n: 5,
      sample_mean: 10.4,
      sample_std: 1.14,
    });

    renderWithQuery(<InferencePlatform />);

    fireEvent.click(screen.getByRole("button", { name: "Bayesian One-Sample" }));
    fireEvent.change(screen.getByLabelText("Prior mean"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Prior sigma"), { target: { value: "1000" } });
    fireEvent.click(screen.getByRole("button", { name: "Run Test" }));

    expect(runBayesianOneSample).toHaveBeenCalledWith({
      column: "score",
      prior_mu: 0,
      prior_sigma: 1000,
      credible_level: 0.95,
    });
    expect(await screen.findByText("Bayesian posterior summary")).toBeTruthy();
    expect(await screen.findByText("Strong evidence for H1")).toBeTruthy();
    expect((await screen.findAllByText("Bayes factor (BF10)")).length).toBeGreaterThan(0);
  });

  it("runs Bayesian two-sample analysis and shows posterior difference metrics", async () => {
    runBayesianTwoSample.mockResolvedValue({
      difference_mean: 5.8,
      difference_std: 0.72,
      ci_lower: 4.39,
      ci_upper: 7.21,
      credible_level: 0.95,
      prob_greater_than_zero: 0.999,
      group_a: {
        posterior_mean: 10.8,
        posterior_std: 0.5,
        ci_lower: 9.82,
        ci_upper: 11.78,
        credible_level: 0.95,
        bayes_factor_10: 8.5,
        n: 5,
        sample_mean: 10.8,
        sample_std: 0.84,
      },
      group_b: {
        posterior_mean: 5.0,
        posterior_std: 0.52,
        ci_lower: 3.98,
        ci_upper: 6.02,
        credible_level: 0.95,
        bayes_factor_10: 3.2,
        n: 5,
        sample_mean: 5.0,
        sample_std: 0.84,
      },
    });

    renderWithQuery(<InferencePlatform />);

    fireEvent.click(screen.getByRole("button", { name: "Bayesian Two-Sample" }));
    fireEvent.change(screen.getByLabelText("Bayesian group B column"), { target: { value: "score_2" } });
    fireEvent.click(screen.getByRole("button", { name: "Run Test" }));

    expect(runBayesianTwoSample).toHaveBeenCalledWith({
      column_a: "score",
      column_b: "score_2",
      credible_level: 0.95,
    });
    expect(await screen.findByText("Bayesian difference summary")).toBeTruthy();
    expect(await screen.findByText("Probability difference > 0")).toBeTruthy();
    expect(await screen.findByText("99.9%")).toBeTruthy();
  });

  it("shows an empty state when no dataset is loaded", () => {
    useDatasetStore.getState().clearDataset();

    renderWithQuery(<InferencePlatform />);

    expect(screen.getByText("Import a dataset to run statistical inference.")).toBeTruthy();
  });
});
