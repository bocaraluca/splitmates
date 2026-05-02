import { describe, it, expect } from "vitest";
import { expenseSchema } from "@/lib/splitmates/validation/schemas";

describe("expenseSchema custom validations", () => {
  const baseExpense = {
    title: "Dinner",
    amount: 100,
    category: "food",
    date: "2026-05-02T20:00:00.000Z",
    paidByUserId: 1,
  };

  it("fails if splitType is 'equal' but explicit shares are provided", () => {
    const result = expenseSchema.safeParse({
      ...baseExpense,
      splitType: "equal",
      memberIds: [1, 2],
      shares: [{ userId: 1, amount: 50 }, { userId: 2, amount: 50 }], 
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Equal split cannot include explicit shares.");
      expect(result.error.issues[0].path).toContain("shares");
    }
  });

  it("fails if splitType is 'custom' but no shares are provided", () => {
    const result = expenseSchema.safeParse({
      ...baseExpense,
      splitType: "custom",
      memberIds: [],
      shares: [], 
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Custom split requires shares.");
      expect(result.error.issues[0].path).toContain("shares");
    }
  });

  it("fails if splitType is 'custom' but shares do not sum up to total", () => {
    const result = expenseSchema.safeParse({
      ...baseExpense,
      splitType: "custom",
      memberIds: [],
      shares: [
        { userId: 1, amount: 50 },
        { userId: 2, amount: 40 }, 
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Custom shares must add up to the expense amount.");
      expect(result.error.issues[0].path).toContain("shares");
    }
  });
});