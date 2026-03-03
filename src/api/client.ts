/**
 * HTTP client for communicating with the FastAPI sidecar backend.
 *
 * In production (Tauri), the port and token are injected by the Tauri shell
 * at startup. In development, they fall back to environment variables.
 */

declare global {
  interface Window {
    __LUMINA_API_PORT__?: number;
    __LUMINA_API_TOKEN__?: string;
  }
}

function getBaseUrl(): string {
  const port = window.__LUMINA_API_PORT__ ?? 8089;
  return `http://127.0.0.1:${port}`;
}

function getToken(): string {
  return window.__LUMINA_API_TOKEN__ ?? "dev-token";
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