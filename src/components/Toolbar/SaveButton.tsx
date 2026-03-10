import { useSaveProject } from "@/api/project";
import { serializeProject } from "@/services/projectSerializer";

interface SaveButtonProps {
  onSaved?: () => void;
}

function ensureLuminaExtension(path: string): string {
  return path.toLowerCase().endsWith(".lumina") ? path : `${path}.lumina`;
}

async function getSavePath(): Promise<string | null> {
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({
      filters: [{ name: "Lumina Project", extensions: ["lumina"] }],
    });

    return typeof path === "string" ? path : null;
  } catch {
    const fallback = window.prompt("Save path (dev mode):");
    return fallback && fallback.trim().length > 0 ? fallback.trim() : null;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to save project.";
}

export function SaveButton({ onSaved }: SaveButtonProps) {
  const saveProject = useSaveProject();

  const handleSave = async () => {
    const project = serializeProject();
    if (!project) {
      window.alert("Import a dataset before saving a project.");
      return;
    }

    const path = await getSavePath();
    if (!path) {
      return;
    }

    try {
      const normalizedPath = ensureLuminaExtension(path);
      await saveProject.mutateAsync({
        file_path: normalizedPath,
        project,
      });

      onSaved?.();
      window.alert(`Project saved to:\n${normalizedPath}`);
    } catch (error) {
      window.alert(`Save failed: ${getErrorMessage(error)}`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={saveProject.isPending}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {saveProject.isPending ? "Saving..." : "Save"}
    </button>
  );
}