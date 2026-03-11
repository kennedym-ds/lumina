"""Plugin loader for Lumina extensibility.

Plugins are Python files in a user-configurable directory.
They register custom chart types, transforms, and statistical tests via decorators.
"""

from __future__ import annotations

import importlib.util
import logging
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

ChartPlugin = Callable[..., Any]
TransformPlugin = Callable[..., Any]
TestPlugin = Callable[..., Any]

_chart_plugins: dict[str, ChartPlugin] = {}
_transform_plugins: dict[str, TransformPlugin] = {}
_test_plugins: dict[str, TestPlugin] = {}


def register_chart_type(name: str) -> Callable[[ChartPlugin], ChartPlugin]:
    """Decorator to register a custom chart builder function."""

    def decorator(func: ChartPlugin) -> ChartPlugin:
        _chart_plugins[name] = func
        logger.info("Registered chart plugin: %s", name)
        return func

    return decorator



def register_transform(name: str) -> Callable[[TransformPlugin], TransformPlugin]:
    """Decorator to register a custom transform function."""

    def decorator(func: TransformPlugin) -> TransformPlugin:
        _transform_plugins[name] = func
        logger.info("Registered transform plugin: %s", name)
        return func

    return decorator



def register_test(name: str) -> Callable[[TestPlugin], TestPlugin]:
    """Decorator to register a custom statistical test function."""

    def decorator(func: TestPlugin) -> TestPlugin:
        _test_plugins[name] = func
        logger.info("Registered test plugin: %s", name)
        return func

    return decorator



def get_chart_plugins() -> dict[str, ChartPlugin]:
    """Return a copy of the registered chart plugins."""

    return dict(_chart_plugins)



def get_transform_plugins() -> dict[str, TransformPlugin]:
    """Return a copy of the registered transform plugins."""

    return dict(_transform_plugins)



def get_test_plugins() -> dict[str, TestPlugin]:
    """Return a copy of the registered statistical test plugins."""

    return dict(_test_plugins)



def _load_module(plugin_file: Path) -> None:
    module_name = f"lumina_plugin_{plugin_file.stem}"
    spec = importlib.util.spec_from_file_location(module_name, plugin_file)
    if spec is None or spec.loader is None:
        raise ImportError(f"Unable to create import spec for plugin '{plugin_file.name}'")

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)



def load_plugins(plugin_dir: str | Path) -> dict[str, list[str]]:
    """Load all plugin modules from the configured plugin directory."""

    plugin_path = Path(plugin_dir)
    loaded = {"charts": [], "transforms": [], "tests": []}
    clear_plugins()

    if not plugin_path.exists():
        logger.info("Plugin directory not found: %s", plugin_path)
        return loaded

    if not plugin_path.is_dir():
        logger.warning("Plugin path is not a directory: %s", plugin_path)
        return loaded

    for plugin_file in sorted(plugin_path.glob("*.py")):
        if plugin_file.name.startswith("_"):
            continue

        try:
            _load_module(plugin_file)
            logger.info("Loaded plugin: %s", plugin_file.name)
        except Exception:
            logger.exception("Failed to load plugin: %s", plugin_file.name)

    loaded["charts"] = sorted(_chart_plugins)
    loaded["transforms"] = sorted(_transform_plugins)
    loaded["tests"] = sorted(_test_plugins)
    return loaded



def clear_plugins() -> None:
    """Clear all registered plugins (primarily for tests)."""

    _chart_plugins.clear()
    _transform_plugins.clear()
    _test_plugins.clear()
