# Research: Lumina GUI/UX Best Practices for Data Visualization

**Date**: 2026-03-03T00:00:00Z
**Researcher**: researcher-agent
**Confidence**: High
**Tools Used**: Synthesized from established HCI and Data Visualization UX paradigms (JASP, jamovi, Tableau, Power BI, Orange).

## Summary
Comparable statistical and BI tools rely heavily on clear variable role assignment (drag-and-drop shelves), split-pane responsive architectures, and real-time computation feedback. Lumina's current spec covers the core technical requirements but lacks crucial onboarding UX patterns (like sample datasets), detailed accessible data visualization considerations, and micro-interactions (like empty states and variable typing) that define professional data tools.

## Key Findings

### 1. GUI Patterns in Comparable Tools
*   **Variable Role Assignment**: 
    *   *Tableau / Power BI:* Use **"Shelves" or "Drop Zones"**. Users drag variables from a sidebar into specific roles (X-Axis, Y-Axis, Color, Tooltip). 
    *   *JASP / jamovi:* Use a **Split-Pane Selection** pattern. Variables are listed on the left; users select them and click right-facing arrows (or drag) to move them into specific analysis fields (e.g., "Dependent Variable", "Covariates"). This is highly effective for non-programmers.
*   **Data Preparation / Cleaning**: Most modern tools use distinctive **Data Type Icons** (e.g., a ruler for continuous, a Venn diagram for nominal, bars for ordinal) next to variable names. Clicking the icon allows instant type conversion. 
*   **Onboarding / First-Run**: JASP and jamovi excel here by providing a **"Data Library" of built-in sample datasets** (with accompanying tutorials). This prevents the "blank canvas syndrome" when a user installs the app.
*   **Undo/Redo**: Desktop apps *must* have Ctrl+Z / Ctrl+Y. In data tools, this is usually implemented as a state history of the application configuration (which variables are mapped where), rather than undoing the actual data mutations unless a specific data-prep environment is active.
*   **Keyboard Shortcuts**: Arrow keys for navigating the data table, `Delete` to remove a variable from a shelf, `Ctrl+C` on a chart to copy it to the clipboard (not just export via menu).

### 2. Modern Desktop Data App UX Patterns
*   **Responsive Panel Layouts**: Fixed layouts fail in data-viz. The standard is **Collapsible, Resizable Split-Panes**. Users need to collapse the sidebar/data table to maximize the chart view. (Reference: VS Code, Tableau).
*   **Dark Mode / Theming**: Analytical tools in dark mode must avoid pure black (`#000000`) to reduce eye strain. Charts must automatically invert axis lines, gridlines, and text labels while maintaining semantic chart colors.
*   **Progress Indicators**: For tasks > 1 second (e.g., parsing a 1M row CSV, heavy regression):
    *   *Determinate ProgressBar*: For loading files (progress known).
    *   *Indeterminate Spinner with Cancel Button*: For model fitting. Users *must* be able to abort a runaway computation.
*   **Empty States**: A zero-data state should never be a blank white screen. It needs a massive "Drag and drop a CSV here to begin" dashed-border dropzone.
*   **Error States**: "Model convergence failures" shouldn't throw stack traces. They should present standard UI toasts: "The regression model failed to converge. Try standardizing your variables or checking for collinearity."

### 3. Accessibility for Analytical Tools (WCAG Considerations)
*   **Color-Blind Safe Palettes**: The default categorical palette should be colorblind-friendly (e.g., Okabe-Ito, Viridis, or ColorBrewer safe palettes). Never rely solely on red/green for insight.
*   **Screen Reader / Alternative Data**: WCAG requires non-text content to have text alternatives. Every chart should have an accessible, hidden (or toggleable) tabular data view representing exactly what is plotted. Lumina already has a data table, but linking specific chart focus to the underlying table is key.
*   **High-Contrast Mode & Focus**: Keyboard navigation must highlight the currently focused interactive element (e.g., a specific chart point or UI shelf) with a high-contrast focus ring (min 3:1 contrast ratio against the background).

## Gap Analysis & Recommendations for Lumina v1

| Feature / UX Pattern | Description | Impact | Effort | Inspiration |
| :--- | :--- | :--- | :--- | :--- |
| **Built-in Sample Datasets** | 3-4 standard datasets (e.g., Palmer Penguins, Titanic) available on the home screen. | High | Low | JASP, jamovi |
| **Drag & Drop / Shelf Assignment** | UI drop-zones for assigning variables to X/Y axes or regression roles instead of generic dropdowns. | High | Medium | Tableau, Power BI |
| **Variable Type Icons & Toggles** | Visual indicators (Continuous/Nominal/Ordinal) in the sidebar, clickable to cast types. | High | Low | jamovi, JASP |
| **Resizable/Collapsible Panes** | Allow users to drag the boundary between the Data Table, Sidebar, and Chart area. | High | Medium | Tableau, VS Code |
| **"Copy to Clipboard" for Charts** | Context menu/button to copy the chart image directly without going through a file export dialogue. | Medium | Low | Excel, PowerBI |
| **Drag-and-Drop File Import** | macOS/Windows standard: drag a `.csv` or `.lumina` file directly onto the app window to load. | High | Low | Generic Desktop UX |
| **Clear Empty / Zero-Data States** | Actionable visual drop-zones and text prompts when no data is loaded or a chart has no variables assigned. | Medium | Low | DataWrapper |
| **Abort/Cancel Computation** | A button on the UI to kill a long-running FastAPI backend thread (e.g., during heavy model fitting). | High | High | Orange |
| **Colorblind-Safe Default Palette** | Default Plotly color sequence set to an accessible palette (like Okabe-Ito) rather than standard D3 colors. | Medium | Low | R (ggplot2), standard |
| **Contextual Error Messages** | Translate mathematical backend errors (e.g., singular matrix) into human-readable UI advice. | Medium | Medium | jamovi |
| **Keyboard Navigable Data Table** | Ensure the virtualized React table supports full spreadsheet-like keyboard navigation (arrows, page up/down). | Medium | Medium | Excel, standard |
| **Chart-to-Table Cross-Highlighting** | Selecting points on the Plotly chart highlights the specific rows in the virtualized data table. | High | High | Spotfire, Tableau |

## Open Questions
- [ ] How will the FastAPI backend handle heavy concurrent requests if the user rapidly scrubs/changes variables (Debouncing strategy)?
- [ ] Will the `.lumina` project file bundle the CSV data, or just hold file paths and configuration? Bundling data drastically increases file size but improves portability.
