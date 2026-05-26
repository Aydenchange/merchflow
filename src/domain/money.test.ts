import { describe, expect, it } from "vitest";
import { addMoney, multiplyMoney, toMinorUnits } from "./money";

describe("money helpers", () => {
  it("converts decimal string amounts to integer minor units", () => {
    expect(toMinorUnits("12.50")).toBe(1250);
    expect(toMinorUnits("0.99")).toBe(99);
  });

  it("rejects amounts with more than two decimal places", () => {
    expect(() => toMinorUnits("12.345")).toThrow(
      "Money amount must have at most two decimal places",
    );
  });

  it("adds money in integer minor units", () => {
    expect(addMoney(1250, 250)).toBe(1500);
  });

  it("multiplies money by positive integer quantity", () => {
    expect(multiplyMoney(1299, 3)).toBe(3897);
  });

  it("rejects non-positive quantity", () => {
    expect(() => multiplyMoney(1299, 0)).toThrow("Quantity must be positive");
  });
});
