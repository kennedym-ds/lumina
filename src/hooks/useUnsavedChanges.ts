import { useCallback, useEffect, useRef, useState } from "react";
import { useChartStore } from "@/stores/chartStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";
import { useDatasetStore } from "@/stores/datasetStore";
import { useRegressionStore } from "@/stores/regressionStore";

interface UnsavedChangesResult {
  isDirty: boolean;
  markClean: () => void;
}

export function useUnsavedChanges(): UnsavedChangesResult {
  const [isDirty, setIsDirty] = useState(false);
  const changeCounterRef = useRef(0);
  const cleanCounterRef = useRef(0);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const markClean = useCallback(() => {
    cleanCounterRef.current = changeCounterRef.current;
    isDirtyRef.current = false;
    setIsDirty(false);
  }, []);

  useEffect(() => {
    const handleChange = () => {
      changeCounterRef.current += 1;
      const nextDirty = changeCounterRef.current > cleanCounterRef.current;
      isDirtyRef.current = nextDirty;
      setIsDirty(nextDirty);
    };

    const unsubscribers = [
      useDatasetStore.subscribe(handleChange),
      useChartStore.subscribe(handleChange),
      useCrossFilterStore.subscribe(handleChange),
      useRegressionStore.subscribe(handleChange),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        unsubscribe();
      });
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    let unlistenCloseRequested: (() => void) | undefined;

    const setupTauriCloseGuard = async () => {
      try {
        const [{ getCurrentWindow }, { confirm }] = await Promise.all([
          import("@tauri-apps/api/window"),
          import("@tauri-apps/plugin-dialog"),
        ]);

        const appWindow = getCurrentWindow();
        unlistenCloseRequested = await appWindow.onCloseRequested(async (event) => {
          if (!isDirtyRef.current) {
            return;
          }

          const shouldDiscard = await confirm("You have unsaved changes. Close without saving?", {
            title: "Unsaved changes",
            kind: "warning",
            okLabel: "Discard",
            cancelLabel: "Keep editing",
          });

          if (!shouldDiscard) {
            event.preventDefault();
          }
        });
      } catch {
        // Not running in Tauri context.
      }
    };

    void setupTauriCloseGuard();

    return () => {
      unlistenCloseRequested?.();
    };
  }, []);

  return { isDirty, markClean };
}