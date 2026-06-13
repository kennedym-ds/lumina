import React from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api/queryClient";
import { initBackendConfig, setBootstrapResult } from "./api/client";
import App from "./App";
import "./index.css";

interface BackendConfig {
  port: number;
  token: string;
}

async function resolveBackendConfig(): Promise<void> {
  // Primary channel: an initialization script injected by the Rust setup() sets
  // window.__LUMINA_CONFIG__ before any page script runs, so it's synchronously
  // available and doesn't depend on the IPC bridge being ready.
  const injected = (window as unknown as { __LUMINA_CONFIG__?: BackendConfig }).__LUMINA_CONFIG__;
  if (injected && typeof injected.port === "number" && typeof injected.token === "string") {
    initBackendConfig(injected);
    setBootstrapResult(true, null);
    return;
  }

  // Fallback channel: the get_backend_config IPC command. Statically imported so
  // bundling can't drop it (a dynamic import previously failed silently in the
  // production build, leaving the app stuck on the default port 8089).
  try {
    const config = await invoke<BackendConfig>("get_backend_config");
    initBackendConfig(config);
    setBootstrapResult(true, null);
  } catch (error) {
    // Browser dev mode (no Tauri) lands here and keeps dev defaults. In a Tauri
    // build this is a real failure — record it so the loading screen can show it.
    setBootstrapResult(false, error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  }
}

async function bootstrap() {
  await resolveBackendConfig();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
