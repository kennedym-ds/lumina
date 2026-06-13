import { useEffect, useState } from "react";

interface BackendReadyState {
  ready: boolean;
  timedOut: boolean;
}

const INITIAL_DELAY_MS = 250;
const MAX_TOTAL_MS = 30_000;

export function useBackendReady(port: number): BackendReadyState {
  const [state, setState] = useState<BackendReadyState>({ ready: false, timedOut: false });

  useEffect(() => {
    let cancelled = false;
    const startTime = Date.now();

    async function poll(delayMs: number): Promise<void> {
      if (cancelled) return;

      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));

      if (cancelled) return;

      if (Date.now() - startTime >= MAX_TOTAL_MS) {
        setState({ ready: false, timedOut: true });
        return;
      }

      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          if (!cancelled) setState({ ready: true, timedOut: false });
          return;
        }
      } catch {
        // ECONNREFUSED, network error, timeout — all expected during sidecar startup
      }

      void poll(Math.min(delayMs * 2, 4000));
    }

    void poll(INITIAL_DELAY_MS);

    return () => {
      cancelled = true;
    };
  }, [port]);

  return state;
}
