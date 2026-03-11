import { useEffect, useMemo, useState } from "react";
import { useApplyTransform, useDeleteTransformColumn, useTransformTypes } from "@/api/transforms";
import { useDatasetStore } from "@/stores/datasetStore";
import type { TransformRequest, TransformResponse, TransformType } from "@/types/transforms";

const DEFAULT_TRANSFORM: TransformType = "log";
const DATE_PART_OPTIONS = ["year", "month", "day", "weekday", "quarter"] as const;
const LOG_BASE_OPTIONS = [
  { value: "e", label: "Natural log (ln)" },
  { value: "10", label: "Base 10" },
] as const;

function parseMapping(input: string): Record<string, string> {
  return input
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((mapping, entry) => {
      const [key, ...rest] = entry.split("=");
      const normalizedKey = key?.trim();
      const value = rest.join("=").trim();
      if (normalizedKey && value) {
        mapping[normalizedKey] = value;
      }
      return mapping;
    }, {});
}

function buildTransformRequest(args: {
  transformType: TransformType;
  outputColumn: string;
  sourceColumn: string;
  logBase: string;
  binCount: string;
  binLabels: string;
  recodeMapping: string;
  recodeDefault: string;
  datePart: (typeof DATE_PART_OPTIONS)[number];
  arithmeticExpression: string;
}): TransformRequest {
  const {
    transformType,
    outputColumn,
    sourceColumn,
    logBase,
    binCount,
    binLabels,
    recodeMapping,
    recodeDefault,
    datePart,
    arithmeticExpression,
  } = args;

  const params: Record<string, unknown> = {};

  if (transformType === "log") {
    params.base = logBase === "10" ? 10 : "e";
  }

  if (transformType === "bin") {
    const count = Number.parseInt(binCount, 10);
    if (Number.isFinite(count) && count > 0) {
      params.count = count;
    }

    const labels = binLabels
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean);
    if (labels.length > 0) {
      params.labels = labels;
    }
  }

  if (transformType === "recode") {
    params.mapping = parseMapping(recodeMapping);
    if (recodeDefault.trim()) {
      params.default = recodeDefault.trim();
    }
  }

  if (transformType === "date_part") {
    params.part = datePart;
  }

  if (transformType === "arithmetic") {
    params.expression = arithmeticExpression.trim();
  }

  return {
    transform_type: transformType,
    output_column: outputColumn.trim(),
    source_column: sourceColumn,
    params,
  };
}

function formatPreview(response: TransformResponse | undefined): string {
  if (!response || response.preview.length === 0) {
    return "";
  }

  return response.preview.map((value) => (value == null ? "null" : String(value))).join(", ");
}

export function TransformBuilder() {
  const columns = useDatasetStore((state) => state.columns);
  const datasetId = useDatasetStore((state) => state.datasetId);
  const [isOpen, setIsOpen] = useState(false);
  const [transformType, setTransformType] = useState<TransformType>(DEFAULT_TRANSFORM);
  const [sourceColumn, setSourceColumn] = useState("");
  const [outputColumn, setOutputColumn] = useState("");
  const [logBase, setLogBase] = useState<string>("e");
  const [binCount, setBinCount] = useState("4");
  const [binLabels, setBinLabels] = useState("");
  const [recodeMapping, setRecodeMapping] = useState("");
  const [recodeDefault, setRecodeDefault] = useState("");
  const [datePart, setDatePart] = useState<(typeof DATE_PART_OPTIONS)[number]>("year");
  const [arithmeticExpression, setArithmeticExpression] = useState("");
  const [createdColumns, setCreatedColumns] = useState<string[]>([]);

  const transformTypesQuery = useTransformTypes();
  const applyTransform = useApplyTransform(datasetId);
  const deleteTransform = useDeleteTransformColumn(datasetId);

  useEffect(() => {
    const firstColumn = columns[0]?.name ?? "";
    setSourceColumn((current) => (columns.some((column) => column.name === current) ? current : firstColumn));
  }, [columns]);

  useEffect(() => {
    setCreatedColumns([]);
    setOutputColumn("");
    setArithmeticExpression("");
    setRecodeMapping("");
    setRecodeDefault("");
  }, [datasetId]);

  const typeOptions = transformTypesQuery.data?.transforms ?? [];
  const hasColumns = columns.length > 0;
  const previewText = useMemo(() => formatPreview(applyTransform.data), [applyTransform.data]);

  const handleApply = async () => {
    if (!sourceColumn || !outputColumn.trim()) {
      return;
    }

    const request = buildTransformRequest({
      transformType,
      outputColumn,
      sourceColumn,
      logBase,
      binCount,
      binLabels,
      recodeMapping,
      recodeDefault,
      datePart,
      arithmeticExpression,
    });

    const response = await applyTransform.mutateAsync(request);
    setCreatedColumns((current) =>
      current.includes(response.output_column) ? current : [...current, response.output_column],
    );
    setOutputColumn("");
  };

  const handleRemove = async (columnName: string) => {
    await deleteTransform.mutateAsync(columnName);
    setCreatedColumns((current) => current.filter((item) => item !== columnName));
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
        aria-expanded={isOpen}
      >
        <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
        <span>Transforms</span>
        {createdColumns.length > 0 ? (
          <span className="rounded-full bg-lumina-100 px-1.5 py-0.5 text-xs text-lumina-700">
            {createdColumns.length}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="space-y-3 border-t border-slate-200 px-3 py-3 text-xs">
          {!hasColumns ? <p className="text-slate-500">Load a dataset to create computed columns.</p> : null}

          {hasColumns ? (
            <>
              <label className="flex flex-col gap-1 text-slate-600">
                <span className="font-medium text-slate-700">Transform type</span>
                <select
                  value={transformType}
                  onChange={(event) => setTransformType(event.target.value as TransformType)}
                  className="rounded border border-slate-300 px-2 py-1.5"
                  aria-label="Transform type"
                >
                  {(typeOptions.length > 0 ? typeOptions : [{ type: DEFAULT_TRANSFORM, label: "Logarithm" }]).map(
                    (option) => (
                      <option key={option.type} value={option.type}>
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-slate-600">
                  <span className="font-medium text-slate-700">Source column</span>
                  <select
                    value={sourceColumn}
                    onChange={(event) => setSourceColumn(event.target.value)}
                    className="rounded border border-slate-300 px-2 py-1.5"
                    aria-label="Source column"
                  >
                    {columns.map((column) => (
                      <option key={column.name} value={column.name}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-slate-600">
                  <span className="font-medium text-slate-700">Output column</span>
                  <input
                    type="text"
                    value={outputColumn}
                    onChange={(event) => setOutputColumn(event.target.value)}
                    className="rounded border border-slate-300 px-2 py-1.5"
                    placeholder="new_column"
                    aria-label="Output column"
                  />
                </label>
              </div>

              {transformType === "log" ? (
                <label className="flex flex-col gap-1 text-slate-600">
                  <span className="font-medium text-slate-700">Log base</span>
                  <select
                    value={logBase}
                    onChange={(event) => setLogBase(event.target.value)}
                    className="rounded border border-slate-300 px-2 py-1.5"
                    aria-label="Log base"
                  >
                    {LOG_BASE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {transformType === "bin" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-slate-600">
                    <span className="font-medium text-slate-700">Number of bins</span>
                    <input
                      type="number"
                      min={1}
                      value={binCount}
                      onChange={(event) => setBinCount(event.target.value)}
                      className="rounded border border-slate-300 px-2 py-1.5"
                      aria-label="Number of bins"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-slate-600">
                    <span className="font-medium text-slate-700">Labels (optional)</span>
                    <input
                      type="text"
                      value={binLabels}
                      onChange={(event) => setBinLabels(event.target.value)}
                      className="rounded border border-slate-300 px-2 py-1.5"
                      placeholder="low, medium, high"
                      aria-label="Bin labels"
                    />
                  </label>
                </div>
              ) : null}

              {transformType === "recode" ? (
                <>
                  <label className="flex flex-col gap-1 text-slate-600">
                    <span className="font-medium text-slate-700">Mappings</span>
                    <textarea
                      value={recodeMapping}
                      onChange={(event) => setRecodeMapping(event.target.value)}
                      className="min-h-20 rounded border border-slate-300 px-2 py-1.5"
                      placeholder="A=Group 1&#10;B=Group 1"
                      aria-label="Recode mappings"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-slate-600">
                    <span className="font-medium text-slate-700">Default value (optional)</span>
                    <input
                      type="text"
                      value={recodeDefault}
                      onChange={(event) => setRecodeDefault(event.target.value)}
                      className="rounded border border-slate-300 px-2 py-1.5"
                      placeholder="Other"
                      aria-label="Recode default value"
                    />
                  </label>
                </>
              ) : null}

              {transformType === "date_part" ? (
                <label className="flex flex-col gap-1 text-slate-600">
                  <span className="font-medium text-slate-700">Date part</span>
                  <select
                    value={datePart}
                    onChange={(event) => setDatePart(event.target.value as (typeof DATE_PART_OPTIONS)[number])}
                    className="rounded border border-slate-300 px-2 py-1.5"
                    aria-label="Date part"
                  >
                    {DATE_PART_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {transformType === "arithmetic" ? (
                <label className="flex flex-col gap-1 text-slate-600">
                  <span className="font-medium text-slate-700">Expression</span>
                  <input
                    type="text"
                    value={arithmeticExpression}
                    onChange={(event) => setArithmeticExpression(event.target.value)}
                    className="rounded border border-slate-300 px-2 py-1.5"
                    placeholder="(value + offset) / 2"
                    aria-label="Arithmetic expression"
                  />
                </label>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleApply()}
                  disabled={
                    applyTransform.isPending ||
                    deleteTransform.isPending ||
                    !outputColumn.trim() ||
                    !sourceColumn ||
                    (transformType === "arithmetic" && !arithmeticExpression.trim())
                  }
                  className="rounded bg-lumina-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-lumina-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {applyTransform.isPending ? "Applying…" : "Apply transform"}
                </button>
                <span className="text-slate-500">Row count stays the same; a new column is appended.</span>
              </div>
            </>
          ) : null}

          {applyTransform.data ? (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-800">
              <div>
                Created <strong>{applyTransform.data.output_column}</strong> ({applyTransform.data.dtype}) with {" "}
                {applyTransform.data.null_count.toLocaleString()} nulls across {" "}
                {applyTransform.data.row_count.toLocaleString()} rows.
              </div>
              {previewText ? <div className="mt-1 text-emerald-700">Preview: {previewText}</div> : null}
            </div>
          ) : null}

          {applyTransform.error ? <p className="text-red-600">{applyTransform.error.message}</p> : null}
          {deleteTransform.error ? <p className="text-red-600">{deleteTransform.error.message}</p> : null}
          {transformTypesQuery.error ? <p className="text-red-600">{transformTypesQuery.error.message}</p> : null}

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Computed columns</h3>
            {createdColumns.length === 0 ? (
              <p className="text-slate-500">No computed columns created in this session yet.</p>
            ) : (
              <ul className="space-y-1">
                {createdColumns.map((columnName) => (
                  <li key={columnName} className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2 py-1.5">
                    <span className="truncate text-slate-700">{columnName}</span>
                    <button
                      type="button"
                      onClick={() => void handleRemove(columnName)}
                      disabled={deleteTransform.isPending}
                      className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
