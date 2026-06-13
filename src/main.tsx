import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api/queryClient";
import { initBackendConfig } from "./api/client";
import App from "./App";
import "./index.css";

async function bootstrap() {
  // In production Tauri builds, resolve the backend port and session token via
  // IPC before React mounts. This is race-condition-free: the IPC command reads
  // from managed Rust state, so it's always available once the app starts.
  // In browser dev mode the import throws and the catch keeps dev defaults active.
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const config = await invoke<{ port: number; token: string }>("get_backend_config");
    initBackendConfig(config);
  } catch {
    // Not running in Tauri — dev defaults (port 8089, token "dev-token") remain.
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
