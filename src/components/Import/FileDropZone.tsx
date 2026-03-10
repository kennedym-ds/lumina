import { useEffect, useState } from "react";
import type { DragEvent, PropsWithChildren } from "react";
import type { UploadResponse } from "@/types/data";

interface FileDropZoneProps extends PropsWithChildren {
  onUpload: (file: File, sheet?: string) => Promise<UploadResponse>;
}

function getFileNameFromPath(path: string): string {
  const fromWindows = path.split("\\").pop();
  const fromUnix = path.split("/").pop();
  return fromWindows ?? fromUnix ?? "dropped-file";
}

export function FileDropZone({ children, onUpload }: FileDropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    let unlistenDrop: (() => void) | undefined;
    let unlistenEnter: (() => void) | undefined;
    let unlistenLeave: (() => void) | undefined;

    const setupTauriDragAndDrop = async () => {
      try {
        const [{ listen }, { convertFileSrc }] = await Promise.all([
          import("@tauri-apps/api/event"),
          import("@tauri-apps/api/core"),
        ]);

        unlistenEnter = await listen("tauri://drag-enter", () => {
          setIsDragActive(true);
        });

        unlistenLeave = await listen("tauri://drag-leave", () => {
          setIsDragActive(false);
        });

        unlistenDrop = await listen<{ paths: string[] }>("tauri://drag-drop", async (event) => {
          const path = event.payload?.paths?.[0];
          if (!path) {
            setIsDragActive(false);
            return;
          }

          try {
            const fileUrl = convertFileSrc(path);
            const response = await fetch(fileUrl);
            const blob = await response.blob();
            const file = new File([blob], getFileNameFromPath(path), {
              type: blob.type || "application/octet-stream",
            });
            await onUpload(file);
          } finally {
            setIsDragActive(false);
          }
        });
      } catch {
        // Browser/dev fallback handles drag-drop events without Tauri APIs.
      }
    };

    setupTauriDragAndDrop();

    return () => {
      unlistenDrop?.();
      unlistenEnter?.();
      unlistenLeave?.();
    };
  }, [onUpload]);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    await onUpload(file);
  };

  return (
    <div className="relative h-full" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {children}

      {isDragActive ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-lumina-900/25 backdrop-blur-[1px]">
          <div className="rounded-xl border-2 border-dashed border-lumina-400 bg-white/90 px-8 py-6 text-center shadow-lg">
            <p className="text-base font-semibold text-lumina-800">Drop file to import</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
