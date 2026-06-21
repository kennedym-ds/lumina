"""Multivariate API routes — PCA and KMeans clustering."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.multivariate import (
    ClusterRequest,
    ClusterResponse,
    PCARequest,
    PCAResponse,
)
from app.services.error_translator import translate_error
from app.services.multivariate import compute_clustering, compute_pca
from app.session import store

router = APIRouter(prefix="/api/multivariate", tags=["multivariate"])


def _get_session(dataset_id: str):
    session = store.get(dataset_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return session


@router.post("/{dataset_id}/pca", response_model=PCAResponse)
async def pca(dataset_id: str, request: PCARequest):
    """Fit PCA on the selected numeric columns of the dataset."""

    session = _get_session(dataset_id)
    try:
        result = compute_pca(session.active_dataframe, request.columns, request.n_components)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=translate_error(exc)) from exc

    return PCAResponse(**result)


@router.post("/{dataset_id}/cluster", response_model=ClusterResponse)
async def cluster(dataset_id: str, request: ClusterRequest):
    """Fit KMeans clustering on the selected numeric columns of the dataset."""

    session = _get_session(dataset_id)
    try:
        result = compute_clustering(session.active_dataframe, request.columns, request.n_clusters)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=translate_error(exc)) from exc

    return ClusterResponse(**result)
