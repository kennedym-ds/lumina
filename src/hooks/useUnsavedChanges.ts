import { useCallback, useEffect, useRef, useState } from "react";
import { useChartStore } from "@/stores/chartStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";
import { useDashboardStore } from "@/stores/dashboardStore";
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
      useDashboardStore.subscribe(handleChange),
      useRegressionStore.subscribe(handleChange),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        unsubscribe();
      });
    };
  }, []);

  // NOTE: no close-time guard (neither `beforeunload` nor Tauri `onCloseRequested`).
  // Both intercept the window close in the WebView2 webview and reliably broke the
  // close/X button once the app was interactive (the async confirm held the close
  // open without ever rendering a dialog). A working close button outweighs a
  // close-time "unsaved changes" prompt — the toolbar still surfaces `isDirty`, and
  // an explicit Save action remains. A safe destroy-based guard can be reintroduced
  // later behind the window destroy permission.

  return { isDirty, markClean };
}