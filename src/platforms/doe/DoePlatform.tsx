import { useState } from "react";
import { ApiError } from "@/api/client";
import { useGenerateDesign } from "@/api/doe";
import type { DesignRequest, DesignResponse, Factor } from "@/types/doe";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.userMessage ?? error.detail ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please check your inputs and try again.";
}

function downloadCsv(result: DesignResponse): void {
  const { factor_names, runs } = result;
  const header = factor_names.join(",");
  const rows = runs.map((run) => factor_names.map((name) => String(run[name] ?? "")).join(","));
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `doe_${result.design_type}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

const DESIGN_TYPES: { value: DesignRequest["design_type"]; label: string }[] = [
  { value: "full_factorial", label: "Full Factorial" },
  { value: "fractional_factorial", label: "Fractional Factorial" },
  { value: "plackett_burman", label: "Plackett-Burman" },
];

interface FactorRow extends Factor {
  id: number;
}

let _nextId = 1;
function nextId(): number {
  return _nextId++;
}

function makeDefaultFactor(): FactorRow {
  return { id: nextId(), name: `Factor ${_nextId - 1}`, low: -1, high: 1 };
}

export function DoePlatform() {
  const [factors, setFactors] = useState<FactorRow[]>([makeDefaultFactor(), makeDefaultFactor()]);
  const [designType, setDesignType] = useState<DesignRequest["design_type"]>("full_factorial");
  const [levels, setLevels] = useState(2);
  const [fraction, setFraction] = useState(1);
  const [nCenter, setNCenter] = useState(0);

  const generate = useGenerateDesign();

  const addFactor = () => {
    setFactors((prev) => [...prev, makeDefaultFactor()]);
  };

  const removeFactor = (id: number) => {
    setFactors((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFactor = (id: number, field: keyof Factor, value: string | number) => {
    setFactors((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        return { ...f, [field]: field === "name" ? String(value) : Number(value) };
      }),
    );
  };

  const handleGenerate = () => {
    const payload: DesignRequest = {
      factors: factors.map(({ name, low, high }) => ({ name, low, high })),
      design_type: designType,
      ...(designType === "full_factorial" && { levels }),
      ...(designType === "fractional_factorial" && { fraction }),
      n_center: nCenter,
    };
    generate.mutate(payload);
  };

  const result = generate.data;

  return (
    <div className="h-full min-h-0 space-y-4 overflow-auto">
      {/* Factor list */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Factors</h3>
            <p className="text-xs text-slate-500">Define each experimental factor with its operating range.</p>
          </div>
          <button
            type="button"
            onClick={addFactor}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            + Add Factor
          </button>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_100px_100px_32px] gap-2 text-xs font-semibold text-slate-600">
            <span>Name</span>
            <span>Low</span>
            <span>High</span>
            <span />
          </div>
          {factors.map((factor) => (
            <div key={factor.id} className="grid grid-cols-[1fr_100px_100px_32px] items-center gap-2">
              <input
                type="text"
                aria-label="Factor name"
                value={factor.name}
                onChange={(e) => updateFactor(factor.id, "name", e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                aria-label="Factor low value"
                value={factor.low}
                onChange={(e) => updateFactor(factor.id, "low", e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                aria-label="Factor high value"
                value={factor.high}
                onChange={(e) => updateFactor(factor.id, "high", e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                aria-label={`Remove factor ${factor.name}`}
                onClick={() => removeFactor(factor.id)}
                disabled={factors.length <= 2}
                className="rounded-md p-1 text-slate-400 hover:text-red-500 disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Design options */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Design Options</h3>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-medium text-slate-800">Design Type</span>
            <select
              aria-label="Design type"
              value={designType}
              onChange={(e) => setDesignType(e.target.value as DesignRequest["design_type"])}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {DESIGN_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {designType === "full_factorial" && (
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              <span className="font-medium text-slate-800">Levels</span>
              <input
                type="number"
                aria-label="Number of levels"
                min={2}
                max={5}
                value={levels}
                onChange={(e) => setLevels(Math.max(2, Number(e.target.value) || 2))}
                className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
          )}

          {designType === "fractional_factorial" && (
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              <span className="font-medium text-slate-800">Fraction (p in 2^(k-p))</span>
              <input
                type="number"
                aria-label="Fraction exponent"
                min={1}
                max={factors.length - 1}
                value={fraction}
                onChange={(e) => setFraction(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-medium text-slate-800">Center Points</span>
            <input
              type="number"
              aria-label="Number of center points"
              min={0}
              max={10}
              value={nCenter}
              onChange={(e) => setNCenter(Math.max(0, Number(e.target.value) || 0))}
              className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generate.isPending || factors.length < 2}
              className="rounded-md bg-lumina-700 px-4 py-2 text-sm font-medium text-white hover:bg-lumina-800 disabled:opacity-60"
            >
              {generate.isPending ? "Generating…" : "Generate Design"}
            </button>
          </div>
        </div>
      </section>

      {/* Error state */}
      {generate.isError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {getErrorMessage(generate.error)}
        </p>
      ) : null}

      {/* Results */}
      {result ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {/* Summary */}
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-800">Design Summary</h3>
              <div className="flex flex-wrap gap-3">
                <div className="rounded-lg border border-lumina-200 bg-lumina-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-lumina-700">Runs</p>
                  <p className="text-lg font-bold text-slate-900">{result.n_runs}</p>
                </div>
                {result.resolution != null ? (
                  <div className="rounded-lg border border-lumina-200 bg-lumina-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-lumina-700">Resolution</p>
                    <p className="text-lg font-bold text-slate-900">{result.resolution}</p>
                  </div>
                ) : null}
              </div>

              {result.generators && result.generators.length > 0 ? (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-slate-700">Generators</p>
                  <ul className="mt-1 space-y-0.5">
                    {result.generators.map((g) => (
                      <li key={g} className="font-mono text-xs text-slate-600">
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result.notes.length > 0 ? (
                <ul className="mt-2 space-y-0.5">
                  {result.notes.map((note) => (
                    <li key={note} className="text-xs text-slate-500">
                      {note}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => downloadCsv(result)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Download CSV
            </button>
          </div>

          {/* Runs table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-1 pr-3 text-left font-semibold text-slate-600">#</th>
                  {result.factor_names.map((name) => (
                    <th key={name} className="py-1 pr-3 text-right font-semibold text-slate-700">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.runs.map((run, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1 pr-3 text-slate-500">{i + 1}</td>
                    {result.factor_names.map((name) => (
                      <td key={name} className="py-1 pr-3 text-right tabular-nums text-slate-800">
                        {typeof run[name] === "number" ? run[name].toFixed(4) : run[name]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
