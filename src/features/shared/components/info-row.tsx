export function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3">
      <dt className="text-stone-500">{label}</dt>
      <dd
        className={`min-w-0 truncate text-right font-medium text-stone-950 ${
          mono ? "font-mono text-xs" : ""
        }`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
