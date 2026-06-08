export function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-2 truncate font-mono text-xl font-semibold text-stone-950">
        {value}
      </p>
    </div>
  );
}
