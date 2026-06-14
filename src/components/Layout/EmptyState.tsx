import { useMemo } from "react";
import { useLoadSample, useSamplesList, type SampleDataset } from "@/api/samples";
import { ImportDialog } from "@/components/Import/ImportDialog";
import { useDatasetStore } from "@/stores/datasetStore";
import type { UploadResponse } from "@/types/data";

interface EmptyStateProps {
  onUpload: (file: File, sheet?: string) => Promise<UploadResponse>;
  isUploading: boolean;
}

const fallbackSamples: SampleDataset[] = [
  {
    name: "palmer_penguins",
    display_name: "Palmer Penguins",
    description: "Penguin measurements from Palmer Station, Antarctica",
  },
  {
    name: "iris",
    display_name: "Iris",
    description: "Classic Fisher iris flower measurements",
  },
  {
    name: "titanic",
    display_name: "Titanic",
    description: "Passenger survival data from RMS Titanic",
  },
];

const sampleIcons: Record<string, string> = {
  palmer_penguins: "🐧",
  iris: "🌸",
  titanic: "🚢",
};

export function EmptyState({ onUpload, isUploading }: EmptyStateProps) {
  const setDataset = useDatasetStore((state) => state.setDataset);

  const samplesQuery = useSamplesList();
  const loadSampleMutation = useLoadSample();

  const samples = useMemo(() => {
    if (samplesQuery.data && samplesQuery.data.length > 0) {
      return samplesQuery.data;
    }

    return fallbackSamples;
  }, [samplesQuery.data]);

  const activeSampleName = loadSampleMutation.isPending ? loadSampleMutation.variables ?? null : null;

  const handleLoadSample = async (sampleName: string) => {
    const response = await loadSampleMutation.mutateAsync(sampleName);
    setDataset(response);
  };

  return (
    <section className="mx-auto flex h-full max-w-5xl flex-col gap-5 rounded-lg bg-white p-6 shadow-sm">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-slate-300 px-6 py-10 text-center">
        <div className="text-4xl" aria-hidden="true">
          📁
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Import a dataset to get started</h2>
          <p className="mt-1 text-sm text-slate-500">Drag and drop a file anywhere, or browse to choose one manually.</p>
        </div>

        <ImportDialog
          onUpload={onUpload}
          isUploading={isUploading}
          buttonLabel="Browse Files"
          showFormatsHint={false}
          buttonClassName="inline-flex items-center rounded-md bg-lumina-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-lumina-800 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">Or try a sample dataset:</h3>

        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {samples.map((sample) => {
            const isLoadingThisSample = activeSampleName === sample.name;

            return (
              <button
                key={sample.name}
                type="button"
                onClick={() => {
                  void handleLoadSample(sample.name);
                }}
                disabled={loadSampleMutation.isPending || isUploading}
                className="group flex flex-col items-start rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-lumina-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-lumina-50 text-2xl transition group-hover:bg-lumina-100"
                  aria-hidden="true"
                >
                  {sampleIcons[sample.name] ?? "🧪"}
                </span>
                <span className="block text-sm font-semibold text-slate-800">{sample.display_name}</span>
                <span className="mt-1 block flex-1 text-xs leading-relaxed text-slate-500">{sample.description}</span>

                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-lumina-700">
                  {isLoadingThisSample ? "Loading…" : "Load dataset"}
                  {!isLoadingThisSample ? (
                    <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                      →
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
