# Research: Lumina Architecture Specification

**Date**: 2026-03-03  
**Researcher**: researcher-agent  
**Confidence**: High  

## Summary

Lumina's architecture (Tauri v2 + React + FastAPI Sidecar) is highly viable but requires careful management of process lifecycles, Python bundling quirks, and data transport overhead. Below is the structured brief on the required topics.

## 1. Tauri v2 Sidecar Pattern

**Overview & Setup**
In Tauri v2, sidecars are managed primarily via the `@tauri-apps/plugin-shell` plugin. You bundle the FastAPI backend as an external binary by defining it in `tauri.conf.json`:

```json
{
  "plugins": {
    "shell": {
      "scope": [
        { "name": "lumina-backend", "sidecar": true }
      ]
    }
  },
  "bundle": {
    "externalBin": ["binaries/lumina-backend"]
  }
}
```

**Lifecycle Hooks**

* **Startup**: The React frontend (or Tauri Rust setup hook) spawns the sidecar process using `Command.sidecar('lumina-backend').spawn()`.
* **Shutdown**: By default, Tauri handles child process termination when the main window closes *if* spawned via the shell plugin. However, it's safer to also listen for the `tauri://destroyed` or `tauri://close-requested` events and manually terminate the sidecar to prevent zombie processes, particularly on Windows.

**Pitfalls**

* **Port Collisions**: Hardcoding `8000` is risky. Have Tauri dynamically find an open port or generate a random one, pass it to the sidecar as an environment variable or CLI arg, and then communicate that port to the React frontend.
* **Platform-Specific Naming**: The file in `binaries/` must be named exactly as Tauri expects for the target triple (e.g., `lumina-backend-x86_64-pc-windows-msvc.exe`).

## 2. FastAPI + PyInstaller Bundling

**Challenges & Configuration**
Bundling FastAPI with Uvicorn creates "hidden import" challenges because ASGI servers and Pydantic use dynamic module loading.

* **Execution**: You cannot use the `uvicorn` CLI. You must run it programmatically: `if __name__ == '__main__': uvicorn.run(app, host="127.0.0.1", port=port)`. Remove the `reload=True` flag for packaged builds.
* **Spec File (`.spec`)**: You must explicitly define hidden imports for Uvicorn and FastAPI dependencies:

```python
hiddenimports=[
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'pydantic',
    'fastapi',
]
```

**Binary Size**
Bundling massive computational libraries (`scipy`, `sklearn`, `pandas`) will heavily bloat the payload, often resulting in a **300 MB to 600 MB executable**, mainly due to massive C-dependencies like MKL/OpenBLAS.

* **Mitigation**: Strip unused shared libraries if possible, or use `UPX` compression (though UPX can severely slow down the sidecar's startup time—use with caution).

## 3. react-plotly.js Cross-Filtering

**Patterns & Libraries**
Plotly's `onSelected` and `onHover` callbacks emit `selectedData` and `hoverData` objects containing the `points` array (with `pointIndex` and `curveNumber`).

* **State Management**: Store the array of selected indices in a global state manager (e.g., Zustand or Redux).
* **Applying the Filter**: Other Plotly components listen to this global state and update their traces. A common technique is modifying the `marker.opacity` array (e.g., setting unselected points to `0.2` and selected points to `1.0`) directly rather than fully re-rendering the chart.
* **Crossfilter2**: `crossfilter2` is an incredibly fast, pure-JS library for multi-dimensional filtering over large datasets. It pairs perfectly with Plotly. You load your JSON data into a Crossfilter instance, create dimensions, and when `onSelected` triggers in Plotly, you filter the dimension in Crossfilter. You then retrieve the updated matching rows and push them to the other charts.

## 4. Comparable Open-Source Tools

1. **Orange Data Mining**
    * **Pros**: Incredible visual programming paradigm; huge suite of built-in modeling widgets.
    * **Cons**: PyQt-based UI feels dated; node-based layout can become spaghetti; heavy installation.
2. **JASP**
    * **Pros**: C++ engine with beautiful, publication-ready outputs automatically updating as parameters change. Uses a web UI (Vue/QtWebEngine).
    * **Cons**: Focused strictly on statistical tests (frequentist/Bayesian) rather than general data pipelining or ML.
3. **jamovi**
    * **Pros**: Spreadsheet-first interface; very approachable for non-programmers; R-based backend makes it extremely robust analytically.
    * **Cons**: Heavily geared toward social sciences; writing custom modules requires R knowledge; can struggle with purely exploratory visual ML data-mining.
4. **KNIME**
    * **Pros**: Enterprise-grade; massive ecosystem of integrations; handles giant data flows via disk-caching.
    * **Cons**: Java/Eclipse RCP frontend is overwhelmingly complex, visually noisy, and extremely heavy on RAM. Not lightweight desktop-friendly.

## 5. Medium-Scale Data Handling (100K-1M Rows)

**Rendering via WebGL**

* **Scattergl**: For scatter plots over 10K points, transition from `scatter` to `scattergl` in Plotly. It handles ~100K-200K points relatively well. However, it crashes beyond ~500K points due to WebGL context limits or browser memory caps.

**Architectural Strategies**

1. **Server-Side Aggregation (Datashader-style)**: Do not send 1M rows to the browser as JSON. Have FastAPI compute a density heat map, hexbin, or prerendered image tile and send *that* to the frontend. WebGL in Plotly is great, but 1M rows of JSON text is ~200MB, which will lock up the React thread during JSON parsing alone (before rendering even starts).
2. **Downsampling**: For line charts, utilize algorithms like LTTB (Largest Triangle Three Buckets) in the FastAPI backend. It retains the visual "shape" and outliers of a 1M row timeseries using only 2,000 points.
3. **Binary Transport**: If you absolutely must send 100K+ rows to React, **do not use JSON**. Use Apache Arrow file format over HTTP, or Parquet. In React, parse the bytes using `apache-arrow` to extract typed arrays (Float32Array) directly into Plotly traces.
4. **Virtualization**: For data tables viewing the raw data, utilize `ag-grid-react` or `@tanstack/react-virtual` with server-side pagination to only load the ~50 rows the user is currently displaying.

## Recommendations

- **Transport**: Switch to Apache Arrow (via `pyarrow` on backend and `apache-arrow` JS library) for transferring matrix data between the Sidecar and React instead of JSON.
* **Port Management**: Implement dynamic port negotiation for the FastAPI sidecar on startup.
* **Plotting**: Default all scatter plots to `scattergl`, but fall back to server-side aggregation for datasets exceeding roughly 250,000 rows.
