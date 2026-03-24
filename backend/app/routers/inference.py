"""Statistical inference API routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.inference import (
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
    FactorialAnovaFactor,
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
)
from app.services.bayesian import bayesian_one_sample, bayesian_two_sample
from app.services.inference import (
    _coerce_numeric,
    _ensure_columns_exist,
    run_anova,
    run_chi_square,
    run_ci,
    run_factorial_anova,
    run_kruskal,
    run_mann_whitney,
    run_normality,
    run_power_analysis,
    run_repeated_measures_anova,
    run_ttest,
    run_tukey_hsd,
    run_wilcoxon,
)
from app.session import store

router = APIRouter(prefix="/api/inference", tags=["inference"])


def _get_session(dataset_id: str):
    """Get a dataset session or raise 404."""

    session = store.get(dataset_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return session


def _get_numeric_values(session, column: str):
    dataframe = session.active_dataframe
    _ensure_columns_exist(dataframe, [column])
    return _coerce_numeric(dataframe[column], column).dropna().to_numpy(dtype=float)


def _remember_inference_result(session, kind: str, request, response) -> None:
    entry = {"kind": kind, **request.model_dump(exclude_none=True), **response.model_dump()}
    session.inference_results.append(entry)
    session.inference_results = session.inference_results[-10:]


@router.post("/{dataset_id}/ttest", response_model=TTestResponse)
async def ttest(dataset_id: str, request: TTestRequest):
    """Run a t-test against the active dataset."""

    session = _get_session(dataset_id)

    try:
        payload = run_ttest(session.active_dataframe, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response = TTestResponse(**payload)
    _remember_inference_result(session, "ttest", request, response)
    return response


@router.post("/{dataset_id}/chi_square", response_model=ChiSquareResponse)
async def chi_square(dataset_id: str, request: ChiSquareRequest):
    """Run a chi-square test of independence against the active dataset."""

    session = _get_session(dataset_id)

    try:
        payload = run_chi_square(session.active_dataframe, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response = ChiSquareResponse(**payload)
    _remember_inference_result(session, "chi_square", request, response)
    return response


@router.post("/{dataset_id}/anova", response_model=AnovaResponse)
async def anova(dataset_id: str, request: AnovaRequest):
    """Run a one-way ANOVA test against the active dataset."""

    session = _get_session(dataset_id)

    try:
        payload = run_anova(session.active_dataframe, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response = AnovaResponse(**payload)
    _remember_inference_result(session, "anova", request, response)
    return response


@router.post("/{dataset_id}/ci", response_model=CIResponse)
async def compute_confidence_interval(dataset_id: str, request: CIRequest):
    """Run a confidence interval estimate against the active dataset."""

    session = _get_session(dataset_id)

    try:
        payload = run_ci(session.active_dataframe, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response = CIResponse(**payload)
    _remember_inference_result(session, "ci", request, response)
    return response


@router.post("/{dataset_id}/tukey_hsd", response_model=TukeyHSDResponse)
async def tukey_hsd(dataset_id: str, request: TukeyHSDRequest):
    """Run Tukey HSD pairwise comparisons against the active dataset."""

    session = _get_session(dataset_id)

    try:
        payload = run_tukey_hsd(session.active_dataframe, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response = TukeyHSDResponse(**payload)
    _remember_inference_result(session, "tukey_hsd", request, response)
    return response


@router.post("/{dataset_id}/mann_whitney", response_model=MannWhitneyResponse)
async def mann_whitney(dataset_id: str, request: MannWhitneyRequest):
    """Run a Mann-Whitney U test against the active dataset."""

    session = _get_session(dataset_id)

    try:
        payload = run_mann_whitney(session.active_dataframe, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response = MannWhitneyResponse(**payload)
    _remember_inference_result(session, "mann_whitney", request, response)
    return response


@router.post("/{dataset_id}/wilcoxon", response_model=WilcoxonResponse)
async def wilcoxon(dataset_id: str, request: WilcoxonRequest):
    """Run a Wilcoxon signed-rank test against the active dataset."""

    session = _get_session(dataset_id)

    try:
        payload = run_wilcoxon(session.active_dataframe, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response = WilcoxonResponse(**payload)
    _remember_inference_result(session, "wilcoxon", request, response)
    return response


@router.post("/{dataset_id}/kruskal", response_model=KruskalResponse)
async def kruskal(dataset_id: str, request: KruskalRequest):
    """Run a Kruskal-Wallis test against the active dataset."""

    session = _get_session(dataset_id)

    try:
        payload = run_kruskal(session.active_dataframe, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response = KruskalResponse(**payload)
    _remember_inference_result(session, "kruskal", request, response)
    return response


@router.post("/{dataset_id}/normality", response_model=NormalityResponse)
async def normality(dataset_id: str, request: NormalityRequest):
    """Run combined normality checks against the active dataset."""

    session = _get_session(dataset_id)

    try:
        payload = run_normality(session.active_dataframe, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response = NormalityResponse(**payload)
    _remember_inference_result(session, "normality", request, response)
    return response


@router.post("/{dataset_id}/power", response_model=PowerAnalysisResponse)
async def power_analysis(dataset_id: str, request: PowerAnalysisRequest):
    """Run a prospective power analysis for t-tests or one-way ANOVA."""

    session = _get_session(dataset_id)

    try:
        payload = run_power_analysis(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response = PowerAnalysisResponse(**payload)
    _remember_inference_result(session, "power", request, response)
    return response


@router.post("/{dataset_id}/bayesian/one_sample", response_model=BayesianOneSampleResponse)
async def bayesian_one_sample_endpoint(dataset_id: str, request: BayesianOneSampleRequest):
    """Run a Bayesian one-sample estimate against the active dataset."""

    session = _get_session(dataset_id)

    try:
        sample = _get_numeric_values(session, request.column)
        payload = bayesian_one_sample(
            sample,
            prior_mu=request.prior_mu,
            prior_sigma=request.prior_sigma,
            credible_level=request.credible_level,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response = BayesianOneSampleResponse.model_validate(payload)
    _remember_inference_result(session, "bayesian_one_sample", request, response)
    return response


@router.post("/{dataset_id}/bayesian/two_sample", response_model=BayesianTwoSampleResponse)
async def bayesian_two_sample_endpoint(dataset_id: str, request: BayesianTwoSampleRequest):
    """Run a Bayesian two-sample estimate against the active dataset."""

    session = _get_session(dataset_id)

    try:
        group_a = _get_numeric_values(session, request.column_a)
        group_b = _get_numeric_values(session, request.column_b)
        payload = bayesian_two_sample(group_a, group_b, credible_level=request.credible_level)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response = BayesianTwoSampleResponse.model_validate(payload)
    _remember_inference_result(session, "bayesian_two_sample", request, response)
    return response


@router.post("/{dataset_id}/repeated_measures_anova", response_model=RepeatedMeasuresAnovaResponse)
def repeated_measures_anova(dataset_id: str, body: RepeatedMeasuresAnovaRequest):
    session = _get_session(dataset_id)
    df = session.active_dataframe
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    try:
        result = run_repeated_measures_anova(
            df,
            subject_column=body.subject_column,
            within_column=body.within_column,
            dependent_column=body.dependent_column,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _remember_inference_result(session, "repeated_measures_anova", body, RepeatedMeasuresAnovaResponse(**result))
    return RepeatedMeasuresAnovaResponse(**result)


@router.post("/{dataset_id}/factorial_anova", response_model=FactorialAnovaResponse)
def factorial_anova(dataset_id: str, body: FactorialAnovaRequest):
    session = _get_session(dataset_id)
    df = session.active_dataframe
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    try:
        result = run_factorial_anova(df, dependent_column=body.dependent_column, factors=body.factors)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    response = FactorialAnovaResponse(
        table=[FactorialAnovaFactor(**r) for r in result["table"]],
        n_observations=result["n_observations"],
        reject_any=result["reject_any"],
    )
    _remember_inference_result(session, "factorial_anova", body, response)
    return response
