"""Bayesian inference services built on NumPy and SciPy."""

from __future__ import annotations

from typing import Iterable

import numpy as np
import pandas as pd
from scipy import stats

_EPSILON = 1e-12


def _validate_probability(value: float, field_name: str) -> None:
    if not 0.0 < value < 1.0:
        raise ValueError(f"{field_name} must be between 0 and 1")


def _prepare_sample(data: Iterable[float]) -> np.ndarray:
    values = np.asarray(list(data), dtype=float)
    values = values[np.isfinite(values)]
    if values.size < 2:
        raise ValueError("Bayesian estimation requires at least 2 observations")
    return values


def _credible_interval(mean: float, std: float, credible_level: float) -> tuple[float, float]:
    z_value = float(stats.norm.ppf(0.5 + credible_level / 2.0))
    margin = z_value * std
    return mean - margin, mean + margin


def _bayes_factor_10(sample_mean: float, sample_variance: float, n: int, prior_mu: float, prior_sigma: float) -> float:
    sampling_scale = float(np.sqrt(max(sample_variance / n, _EPSILON)))
    alternative_scale = float(np.sqrt(max(sample_variance / n + prior_sigma**2, _EPSILON)))
    log_marginal_h1 = float(stats.norm.logpdf(sample_mean, loc=prior_mu, scale=alternative_scale))
    log_marginal_h0 = float(stats.norm.logpdf(sample_mean, loc=0.0, scale=sampling_scale))
    return float(np.exp(log_marginal_h1 - log_marginal_h0))


def bayesian_one_sample(
    data: Iterable[float],
    prior_mu: float = 0.0,
    prior_sigma: float = 1e6,
    credible_level: float = 0.95,
) -> dict[str, float | int]:
    """Estimate a posterior mean for one sample using a normal-normal update."""

    if prior_sigma <= 0:
        raise ValueError("prior_sigma must be greater than 0")
    _validate_probability(credible_level, "credible_level")

    values = _prepare_sample(data)
    n = int(values.size)
    sample_mean = float(values.mean())
    sample_std = float(values.std(ddof=1))
    sample_variance = max(sample_std**2, _EPSILON)
    prior_variance = prior_sigma**2

    posterior_precision = (1.0 / prior_variance) + (n / sample_variance)
    posterior_variance = 1.0 / posterior_precision
    posterior_mean = posterior_variance * ((prior_mu / prior_variance) + (n * sample_mean / sample_variance))
    posterior_std = float(np.sqrt(posterior_variance))
    ci_lower, ci_upper = _credible_interval(posterior_mean, posterior_std, credible_level)

    return {
        "posterior_mean": float(posterior_mean),
        "posterior_std": posterior_std,
        "ci_lower": float(ci_lower),
        "ci_upper": float(ci_upper),
        "credible_level": credible_level,
        "bayes_factor_10": _bayes_factor_10(sample_mean, sample_variance, n, prior_mu, prior_sigma),
        "n": n,
        "sample_mean": sample_mean,
        "sample_std": sample_std,
    }


def bayesian_two_sample(
    group_a: Iterable[float],
    group_b: Iterable[float],
    credible_level: float = 0.95,
) -> dict[str, object]:
    """Estimate the posterior mean difference between two independent samples."""

    _validate_probability(credible_level, "credible_level")

    posterior_a = bayesian_one_sample(group_a, credible_level=credible_level)
    posterior_b = bayesian_one_sample(group_b, credible_level=credible_level)

    difference_mean = float(posterior_a["posterior_mean"] - posterior_b["posterior_mean"])
    difference_variance = float(posterior_a["posterior_std"] ** 2 + posterior_b["posterior_std"] ** 2)
    difference_std = float(np.sqrt(max(difference_variance, _EPSILON)))
    ci_lower, ci_upper = _credible_interval(difference_mean, difference_std, credible_level)

    if difference_std <= np.sqrt(_EPSILON):
        prob_greater_than_zero = 1.0 if difference_mean > 0 else 0.0 if difference_mean < 0 else 0.5
    else:
        prob_greater_than_zero = float(1.0 - stats.norm.cdf(0.0, loc=difference_mean, scale=difference_std))

    return {
        "difference_mean": difference_mean,
        "difference_std": difference_std,
        "ci_lower": float(ci_lower),
        "ci_upper": float(ci_upper),
        "credible_level": credible_level,
        "prob_greater_than_zero": prob_greater_than_zero,
        "group_a": posterior_a,
        "group_b": posterior_b,
    }


def bayesian_linear_regression(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    prior_mu: float = 0.0,
    prior_kappa: float = 0.001,
    prior_alpha: float = 1.0,
    prior_beta: float = 1.0,
    credible_level: float = 0.95,
    missing_strategy: str = "listwise",
) -> dict:
    """Bayesian linear regression with conjugate normal-inverse-gamma prior.

    Uses the analytic posterior for the normal linear model:
      y | X, beta, sigma^2 ~ N(X @ beta, sigma^2 I)
      beta | sigma^2 ~ N(mu_0, sigma^2 / kappa_0 * I)
      sigma^2 ~ InvGamma(alpha_0, beta_0)
    """
    all_cols = [dependent] + independents
    missing = [c for c in all_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Columns not found: {missing}")

    if missing_strategy == "mean_imputation":
        sub = df[all_cols].copy()
        for col in all_cols:
            if sub[col].dtype.kind in "iuf":
                sub[col] = sub[col].fillna(sub[col].mean())
        sub = sub.dropna()
    else:
        sub = df[all_cols].dropna()

    if len(sub) < len(independents) + 1:
        raise ValueError("Not enough observations for the number of predictors.")

    y = sub[dependent].values.astype(float)
    X = np.column_stack([np.ones(len(y))] + [sub[c].values.astype(float) for c in independents])
    n, p = X.shape

    # Prior parameters
    mu_0 = np.full(p, prior_mu)
    Lambda_0 = prior_kappa * np.eye(p)
    a_0 = prior_alpha
    b_0 = prior_beta

    # Posterior parameters (conjugate update)
    Lambda_n = Lambda_0 + X.T @ X
    try:
        Lambda_n_inv = np.linalg.inv(Lambda_n)
    except np.linalg.LinAlgError:
        raise ValueError("Design matrix is singular or near-singular. Remove collinear predictors.")
    mu_n = Lambda_n_inv @ (Lambda_0 @ mu_0 + X.T @ y)
    a_n = a_0 + n / 2
    b_n = b_0 + 0.5 * (y @ y + mu_0 @ Lambda_0 @ mu_0 - mu_n @ Lambda_n @ mu_n)

    # Posterior mean and std of sigma^2
    sigma2_mean = float(b_n / (a_n - 1)) if a_n > 1 else float(b_n / a_n)
    sigma2_var = float(b_n**2 / ((a_n - 1) ** 2 * (a_n - 2))) if a_n > 2 else float("inf")
    sigma2_std = float(np.sqrt(sigma2_var)) if np.isfinite(sigma2_var) else float("inf")

    # Marginal posterior of beta is multivariate t
    alpha_half = (1 - credible_level) / 2
    t_crit = float(stats.t.ppf(1 - alpha_half, df=2 * a_n))

    var_names = ["intercept"] + independents
    coefficients = []
    for i, name in enumerate(var_names):
        post_mean = float(mu_n[i])
        scale = float(np.sqrt((b_n / a_n) * Lambda_n_inv[i, i]))
        coefficients.append({
            "variable": name,
            "posterior_mean": post_mean,
            "posterior_std": scale,
            "ci_lower": post_mean - t_crit * scale,
            "ci_upper": post_mean + t_crit * scale,
        })

    # R-squared from posterior mean predictions
    y_pred = X @ mu_n
    ss_res = float(np.sum((y - y_pred) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r_squared = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0

    return {
        "coefficients": coefficients,
        "sigma_squared_mean": sigma2_mean,
        "sigma_squared_std": sigma2_std,
        "r_squared": r_squared,
        "n_observations": n,
        "credible_level": credible_level,
    }
