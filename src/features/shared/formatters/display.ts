export function formatSignedQuantity(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

export function shortId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "None";
  }

  return new Intl.DateTimeFormat("en-SG", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency,
  }).format(amount / 100);
}
