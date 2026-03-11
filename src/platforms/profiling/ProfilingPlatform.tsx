import { useDatasetProfile } from "@/api/profiling";
import { CorrelationHeatmap } from "@/platforms/profiling/CorrelationHeatmap";
import { useDatasetStore } from "@/stores/datasetStore";
import type { ColumnProfile, TopValueProfile } from "@/types/profiling";

export function ProfilingPlatform() {
  const datasetId = useDatasetStore((state) => state.datasetId);
  const profile = useDatasetProfile(datasetId);

  if (!datasetId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        Import a dataset to see profiling report.
      </div>
    );
  }

  if (profile.isLoading) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-lumina-500" />
          Generating profile…
        </span>
      </div>
    );
  }

  if (profile.error) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-red-200 bg-red-50 text-sm text-red-600">
        Failed to generate profile: {profile.error.message}
      </div>
    );
  }

  if (!profile.data) {
    return null;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Rows" value={profile.data.row_count.toLocaleString()} />
          <SummaryCard label="Columns" value={profile.data.column_count.toLocaleString()} />
          <SummaryCard label="Memory" value={formatBytes(profile.data.total_memory_bytes)} />
          <SummaryCard label="Duplicate Rows" value={profile.data.duplicate_row_count.toLocaleString()} />
        </div>

        <CorrelationHeatmap datasetId={datasetId} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {profile.data.columns.map((column) => (
            <ColumnCard key={column.name} profile={column} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function ColumnCard({ profile }: { profile: ColumnProfile }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-slate-800">{profile.name}</h3>
          <p className="text-xs text-slate-500">
            {profile.total_count.toLocaleString()} rows · {profile.unique_count.toLocaleString()} unique · {formatBytes(profile.memory_bytes)}
          </p>
        </div>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{profile.dtype}</span>
      </div>

      <MissingBar missingCount={profile.missing_count} missingPct={profile.missing_pct} />

      {profile.dtype === "numeric" && profile.mean !== null ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs xl:grid-cols-3">
            <StatItem label="Mean" value={profile.mean} />
            <StatItem label="Std" value={profile.std} />
            <StatItem label="Min" value={profile.min} />
            <StatItem label="Q1" value={profile.q1} />
            <StatItem label="Median" value={profile.median} />
            <StatItem label="Q3" value={profile.q3} />
            <StatItem label="Max" value={profile.max} />
            <StatItem label="Skew" value={profile.skewness} />
            <StatItem label="Kurt" value={profile.kurtosis} />
            <StatItem label="Zeros" value={profile.zeros_count} />
          </div>

          {profile.histogram_bins && profile.histogram_counts ? (
            <div>
              <div className="mb-1 text-xs font-medium text-slate-500">Distribution</div>
              <MiniHistogram bins={profile.histogram_bins} counts={profile.histogram_counts} />
            </div>
          ) : null}
        </div>
      ) : null}

      {profile.top_values && profile.top_values.length > 0 ? (
        <div>
          <div className="mb-1 text-xs font-medium text-slate-500">Top values</div>
          <TopValuesBar values={profile.top_values} />
        </div>
      ) : null}
    </section>
  );
}

function MissingBar({ missingCount, missingPct }: { missingCount: number; missingPct: number }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>Missing</span>
        <span>
          {missingCount.toLocaleString()} ({missingPct}%)
        </span>
      </div>
      <div className="h-1.5 rounded bg-slate-100">
        <div className="h-full rounded bg-red-400" style={{ width: `${Math.min(missingPct, 100)}%` }} />
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="text-slate-400">{label}</div>
      <div className="font-mono text-slate-700">{formatNumber(value)}</div>
    </div>
  );
}

function MiniHistogram({ bins, counts }: { bins: number[]; counts: number[] }) {
  const max = Math.max(...counts, 1);

  return (
    <div className="flex h-12 items-end gap-px rounded bg-slate-50 p-1">
      {counts.map((count, index) => (
        <div
          key={`${bins[index]}-${count}`}
          className="flex-1 rounded-t bg-lumina-400"
          style={{ height: `${(count / max) * 100}%` }}
          title={`${bins[index]?.toFixed(1)}–${bins[index + 1]?.toFixed(1)}: ${count}`}
        />
      ))}
    </div>
  );
}

function TopValuesBar({ values }: { values: TopValueProfile[] }) {
  const maxCount = Math.max(...values.map((value) => value.count), 1);

  return (
    <div className="space-y-2">
      {values.map((value) => (
        <div key={value.value} className="flex items-center gap-2 text-xs">
          <span className="w-20 truncate text-slate-600" title={value.value}>
            {value.value}
          </span>
          <div className="h-3 flex-1 rounded bg-slate-100">
            <div className="h-full rounded bg-lumina-300" style={{ width: `${(value.count / maxCount) * 100}%` }} />
          </div>
          <span className="w-20 text-right text-slate-500">
            {value.count.toLocaleString()} ({value.pct}%)
          </span>
        </div>
      ))}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default ProfilingPlatform;
