"""Plugin discovery and execution API routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, HTTPException
from fastapi.encoders import jsonable_encoder

from app.services.plugin_loader import get_chart_plugins, get_test_plugins, get_transform_plugins
from app.session import store

router = APIRouter(prefix="/api/plugins", tags=["plugins"])



def _get_session(dataset_id: str):
    session = store.get(dataset_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return session


@router.get("/")
async def list_plugins() -> dict[str, list[str]]:
    """List all registered plugins."""

    return {
        "charts": sorted(get_chart_plugins()),
        "transforms": sorted(get_transform_plugins()),
        "tests": sorted(get_test_plugins()),
    }


@router.post("/{dataset_id}/tests/{test_name}")
async def run_plugin_test(
    dataset_id: str,
    test_name: str,
    payload: dict[str, Any] | None = Body(default=None),
):
    """Execute a registered statistical test plugin against the active dataset."""

    session = _get_session(dataset_id)
    plugin = get_test_plugins().get(test_name)
    if plugin is None:
        raise HTTPException(status_code=404, detail=f"Plugin test '{test_name}' not found")

    try:
        result = jsonable_encoder(plugin(session.active_dataframe, payload or {}))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Plugin test '{test_name}' failed") from exc

    entry = {"kind": test_name, "plugin": True, "params": payload or {}}
    if isinstance(result, dict):
        entry.update(result)
    else:
        entry["result"] = result
    session.inference_results.append(entry)
    session.inference_results = session.inference_results[-10:]

    return result
