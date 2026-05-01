import { describe, expect, it } from "vitest";
import { expenseSchema, loginSchema, paginationSchema, signupSchema } from "@/lib/splitmates/validation/schemas";

describe("splitmates schemas", () => {
  it("validates registration passwords match", () => {
    expect(() =>
      signupSchema.parse({
        username: "testuser",
        email: "test@example.com",
        password: "password",
        confirmPassword: "password",
      }),
    ).not.toThrow();

    expect(() =>
      signupSchema.parse({
        username: "testuser",
        email: "test@example.com",
        password: "password",
        confirmPassword: "different",
      }),
    ).toThrow("Passwords do not match.");
  });

  it("validates login and pagination inputs", () => {
    expect(loginSchema.parse({ identifier: "raluca", password: "raluca" }).identifier).toBe("raluca");
    expect(paginationSchema.parse({ page: 2, pageSize: 10 }).pageSize).toBe(10);
  });

  it("validates equal and custom expense splits", () => {
    expect(() =>
      expenseSchema.parse({
        title: "Rent",
        amount: 900,
        currency: "RON",
        category: "rent",
        date: new Date().toISOString(),
        paidByUserId: 1,
        splitType: "equal",
        memberIds: [1],
        shares: [],
      }),
    ).not.toThrow();

    expect(() =>
      expenseSchema.parse({
        title: "Dinner",
        amount: 90,
        currency: "RON",
        category: "food",
        date: new Date().toISOString(),
        paidByUserId: 1,
        splitType: "custom",
        memberIds: [],
        shares: [
          { userId: 1, amount: 50 },
          { userId: 2, amount: 20 },
        ],
      }),
    ).toThrow("Custom shares must add up to the expense amount.");
  });
});
