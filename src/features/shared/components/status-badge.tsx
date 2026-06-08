export function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex max-w-[180px] truncate rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(
        value,
      )}`}
      title={value}
    >
      {value}
    </span>
  );
}

function statusClass(value: string) {
  if (value === "PAID" || value === "FULFILLED" || value === "SUCCEEDED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (
    value === "PAYMENT_REQUIRES_REVIEW" ||
    value === "REQUIRES_REVIEW" ||
    value === "requires_review"
  ) {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (value === "PENDING_PAYMENT" || value === "PENDING" || value === "NO_ORDER") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-stone-200 bg-stone-50 text-stone-700";
}
