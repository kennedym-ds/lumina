import { useEffect, useState } from "react";
import { apiClient } from "./api/client";

function App() {
  const [backendStatus, setBackendStatus] = useState<string>("Connecting...");

  useEffect(() => {
    apiClient
      .get<{ status: string }>("/api/health")
      .then((data) => setBackendStatus(data.status === "ok" ? "Backend OK" : "Unexpected response"))
      .catch(() => setBackendStatus("Backend unavailable"));
  }, []);

  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-lumina-700">Lumina</h1>
      <p className="mt-2 text-lg text-gray-600">Data Visualization &amp; Modeling Platform</p>
      <div className="mt-6 rounded-lg border border-gray-200 bg-white px-6 py-3 shadow-sm">
        <span
          className={
            backendStatus === "Backend OK" ? "text-green-600 font-medium" : "text-amber-600"
          }
        >
          {backendStatus}
        </span>
      </div>
    </div>
  );
}

export default App;