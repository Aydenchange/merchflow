export function toMinorUnits(amount: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
    throw new Error("Money amount must have at most two decimal places");
  }

  const [whole, decimal = ""] = amount.split(".");
  return Number(`${whole}${decimal.padEnd(2, "0")}`);
}

export function addMoney(left: number, right: number) {
  return left + right;
}

export function multiplyMoney(unitAmount: number, quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be positive");
  }

  return unitAmount * quantity;
}
