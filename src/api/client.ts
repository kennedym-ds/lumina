/**
 * HTTP client for communicating with the FastAPI sidecar backend.
 *
 * In production (Tauri), port and token are resolved via the `get_backend_config`
 * IPC command before React mounts (see main.tsx bootstrap). In browser dev mode
 * the defaults below are used so `npm run dev` keeps working without Tauri.
 */

interface BackendConfig {
  port: number;
  token: string;
}

let _config: BackendConfig = { port: 8089, token: "dev-token" };

export function initBackendConfig(config: BackendConfig): void {
  _config = config;
}

export function getBackendPort(): number {
  return _config.port;
}

export function getAuthToken(): string {
  return _config.token;
}

function getBaseUrl(): string {
  return `http://127.0.0.1:${_config.port}`;
}

function getToken(): string {
  return _config.token;
}

class ApiClient {
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${getBaseUrl()}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers as Record<string, string>),
    };

    // Don't set Content-Type for FormData (multipart) — browser sets it with boundary
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        errorBody.error ?? "UNKNOWN_ERROR",
        errorBody.detail ?? response.statusText,
        errorBody.user_message,
      );
    }

    return response.json() as Promise<T>;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail: string,
    public userMessage?: string,
  ) {
    super(`[${status}] ${code}: ${detail}`);
    this.name = "ApiError";
  }
}

export const apiClient = new ApiClient();