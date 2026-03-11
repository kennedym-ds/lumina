import { Suspense, useEffect, useState } from "react";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { usePlugins } from "@/api/plugins";
import { FilterBuilder } from "@/components/FilterBuilder/FilterBuilder";
import { TransformBuilder } from "@/components/TransformBuilder/TransformBuilder";
import { DataTable } from "@/components/DataTable/DataTable";
import { EmptyState } from "@/components/Layout/EmptyState";
import { ImportDialog } from "@/components/Import/ImportDialog";
import { FavouritesPanel } from "@/components/Sidebar/FavouritesPanel";
import { SummaryPanel } from "@/components/Sidebar/SummaryPanel";
import { ExportChartButton } from "@/components/Toolbar/ExportChartButton";
import { ExportMenu } from "@/components/Toolbar/ExportMenu";
import { OpenButton } from "@/components/Toolbar/OpenButton";
import { ResetSelectionButton } from "@/components/Toolbar/ResetSelectionButton";
import { SaveButton } from "@/components/Toolbar/SaveButton";
import { SaveViewButton } from "@/components/Toolbar/SaveViewButton";
import { UndoRedoButtons } from "@/components/Toolbar/UndoRedoButtons";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { platforms } from "@/platforms/registry";
import { useChartStore } from "@/stores/chartStore";
import { VariableList } from "@/components/Sidebar/VariableList";
import { useDatasetStore } from "@/stores/datasetStore";
import { useUndoRedoStore } from "@/stores/undoRedoStore";
import type { UploadResponse } from "@/types/data";
import { countPlugins } from "@/types/plugins";

type AppTab = "data" | string;

interface AppLayoutProps {
  onUpload: (file: File, sheet?: string) => Promise<UploadResponse>;
  isUploading: boolean;
}

export function AppLayout({ onUpload, isUploading }: AppLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("data");
  const { data: plugins } = usePlugins();
  const { isDirty, markClean } = useUnsavedChanges();
  const datasetId = useDatasetStore((state) => state.datasetId);
  const fileName = useDatasetStore((state) => state.fileName);
  const pluginCount = countPlugins(plugins);
  const activePlatform = platforms.find((platform) => platform.id === activeTab);
  const ActivePlatformComponent = activePlatform?.component ?? null;
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "lumina-layout",
    panelIds: isSidebarCollapsed ? ["main"] : ["sidebar", "main"],
  });

  useEffect(() => {
    setActiveTab("data");
    useUndoRedoStore.getState().resetHistory();
  }, [datasetId]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      if (target.isContentEditable) {
        return true;
      }

      const tagName = target.tagName.toLowerCase();
      return tagName === "input" || tagName === "textarea" || tagName === "select";
    };

    const undo = () => {
      const chartState = useChartStore.getState();
      const snapshot = useUndoRedoStore.getState().undo({
        charts: chartState.charts.map((chart) => ({ ...chart })),
        activeChartId: chartState.activeChartId,
        label: "Undo",
      });

      if (!snapshot) {
        return;
      }

      useChartStore.getState().hydrateCharts(
        snapshot.charts.map((chart) => ({ ...chart })),
        snapshot.activeChartId,
      );
    };

    const redo = () => {
      const chartState = useChartStore.getState();
      const snapshot = useUndoRedoStore.getState().redo({
        charts: chartState.charts.map((chart) => ({ ...chart })),
        activeChartId: chartState.activeChartId,
        label: "Redo",
      });

      if (!snapshot) {
        return;
      }

      useChartStore.getState().hydrateCharts(
        snapshot.charts.map((chart) => ({ ...chart })),
        snapshot.activeChartId,
      );
    };

    const handler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const isUndo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey;
      const isRedo =
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey));

      if (isUndo) {
        event.preventDefault();
        undo();
        return;
      }

      if (isRedo) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, []);

  return (
    <div className="grid h-screen grid-rows-[auto_1fr] bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-lumina-700">Lumina</h1>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((previous) => !previous)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
          </button>
        </div>

        <div className="flex items-center gap-4">
          {datasetId ? (
            <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("data")}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  activeTab === "data"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                Data
              </button>

              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => setActiveTab(platform.id)}
                  disabled={!datasetId}
                  className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${
                    activeTab === platform.id
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  } disabled:cursor-not-allowed disabled:text-slate-400`}
                >
                  <span aria-hidden="true">{platform.icon}</span>
                  <span>{platform.label}</span>
                </button>
              ))}
            </div>
          ) : null}

          <ResetSelectionButton />
          <UndoRedoButtons />
          <SaveViewButton />
          <OpenButton onLoaded={markClean} />
          <SaveButton onSaved={markClean} />
          <ExportMenu />
          <ExportChartButton />

          {isDirty ? <span className="text-xs font-medium text-amber-700">Unsaved changes</span> : null}

          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
            {pluginCount} plugins loaded
          </span>

          <p className="max-w-[260px] truncate text-sm text-slate-600" title={fileName ?? "No dataset selected"}>
            {fileName ?? "No dataset selected"}
          </p>
          <ImportDialog onUpload={onUpload} isUploading={isUploading} />
        </div>
      </header>

      {!datasetId ? (
        <main className="min-h-0 p-3">
          <EmptyState onUpload={onUpload} isUploading={isUploading} />
        </main>
      ) : (
        <div className="min-h-0 p-3">
          <Group
            orientation="horizontal"
            defaultLayout={defaultLayout}
            onLayoutChanged={onLayoutChanged}
            className="h-full"
          >
            {!isSidebarCollapsed ? (
              <>
                <Panel defaultSize={20} minSize={15} maxSize={35} id="sidebar">
                  <aside className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-3">
                    <div className="min-h-0 overflow-auto">
                      <FilterBuilder />
                    </div>
                    <div className="min-h-0 overflow-auto">
                      <TransformBuilder />
                    </div>
                    <div className="min-h-0 overflow-auto">
                      <VariableList />
                    </div>
                    <div className="min-h-0 overflow-auto">
                      <SummaryPanel />
                    </div>
                    <div className="min-h-0 overflow-auto">
                      <FavouritesPanel />
                    </div>
                  </aside>
                </Panel>
                <Separator className="w-1.5 bg-slate-200 transition-colors hover:bg-lumina-300" />
              </>
            ) : null}

            <Panel defaultSize={isSidebarCollapsed ? 100 : 80} minSize={40} id="main">
              <main className="h-full min-h-0">
                {activeTab === "data" ? <DataTable datasetId={datasetId} /> : null}

                {activeTab !== "data" && ActivePlatformComponent ? (
                  <Suspense
                    fallback={
                      <div className="flex h-full items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
                        Loading...
                      </div>
                    }
                  >
                    <ActivePlatformComponent />
                  </Suspense>
                ) : null}
              </main>
            </Panel>
          </Group>
        </div>
      )}
    </div>
  );
}
