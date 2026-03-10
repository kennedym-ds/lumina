import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { UploadResponse } from "@/types/data";

interface ImportDialogProps {
  onUpload: (file: File, sheet?: string) => Promise<UploadResponse>;
  isUploading: boolean;
  buttonLabel?: string;
  buttonClassName?: string;
}

function getApiErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const errorWithUserMessage = error as Error & { userMessage?: string };
    return errorWithUserMessage.userMessage ?? error.message;
  }
  return "Upload failed. Please try again.";
}

function getFileNameFromPath(path: string): string {
  const splitOnWindows = path.split("\\");
  const splitOnUnix = path.split("/");
  return splitOnWindows[splitOnWindows.length - 1] ?? splitOnUnix[splitOnUnix.length - 1] ?? "imported-file";
}

export function ImportDialog({
  onUpload,
  isUploading,
  buttonLabel = "Import File",
  buttonClassName,
}: ImportDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [lastSelectedFile, setLastSelectedFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File, sheet?: string) => {
    setError(null);

    try {
      const response = await onUpload(file, sheet);
      setLastSelectedFile(file);
      setSheets(response.sheets ?? []);
      setSelectedSheet(response.sheets?.[0] ?? "");
    } catch (uploadError) {
      setError(getApiErrorMessage(uploadError));
    }
  };

  const handleInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    if (!nextFile) {
      return;
    }

    await uploadFile(nextFile);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const openNativePicker = async () => {
    setError(null);

    try {
      const picked = await open({
        multiple: false,
        filters: [
          {
            name: "Data files",
            extensions: ["csv", "tsv", "xlsx", "xls", "parquet"],
          },
        ],
      });

      if (!picked || typeof picked !== "string") {
        return;
      }

      const { convertFileSrc } = await import("@tauri-apps/api/core");
      const fileUrl = convertFileSrc(picked);
      const fileResponse = await fetch(fileUrl);
      const fileBlob = await fileResponse.blob();
      const fileName = getFileNameFromPath(picked);
      const file = new File([fileBlob], fileName, {
        type: fileBlob.type || "application/octet-stream",
      });

      await uploadFile(file);
      return;
    } catch {
      inputRef.current?.click();
    }
  };

  const handleReimportSheet = async () => {
    if (!lastSelectedFile || !selectedSheet) {
      return;
    }

    await uploadFile(lastSelectedFile, selectedSheet);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.xlsx,.xls,.parquet"
        className="hidden"
        onChange={handleInputChange}
      />

      <button
        type="button"
        onClick={openNativePicker}
        disabled={isUploading}
        className={
          buttonClassName ??
          "inline-flex items-center rounded-md bg-lumina-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-lumina-800 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {isUploading ? "Uploading..." : buttonLabel}
      </button>

      {sheets.length > 0 ? (
        <div className="flex items-center gap-2">
          <select
            value={selectedSheet}
            onChange={(event) => setSelectedSheet(event.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 focus:border-lumina-500 focus:outline-none"
          >
            {sheets.map((sheet) => (
              <option key={sheet} value={sheet}>
                {sheet}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleReimportSheet}
            disabled={isUploading || !selectedSheet}
            className="rounded-md border border-lumina-300 px-2 py-1 text-xs font-medium text-lumina-700 hover:bg-lumina-50 disabled:opacity-60"
          >
            Re-import sheet
          </button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
