import { describe, expect, it } from "vitest";
import {
  parseAuthLoginForm,
  parseAuthRegisterForm,
  parseExpenseForm,
  parseGroupForm,
  parseSettlementForm,
} from "@/lib/validators";

function formDataFrom(entries: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    form.set(key, value);
  }
  return form;
}

describe("frontend validators", () => {
  it("parses a valid group form", () => {
    const parsed = parseGroupForm(
      formDataFrom({
        name: "Weekend Trip",
        category: "trip",
      }),
    );

    expect(parsed).toEqual({ name: "Weekend Trip", category: "trip" });
  });

  it("rejects invalid group category", () => {
    expect(() =>
      parseGroupForm(
        formDataFrom({
          name: "Weekend Trip",
          category: "invalid",
        }),
      ),
    ).toThrow("Choose a valid group category.");
  });

  it("rejects missing required fields", () => {
    expect(() =>
      parseGroupForm(
        formDataFrom({
          name: "",
          category: "trip",
        }),
      ),
    ).toThrow("Group name is required.");

    expect(() =>
      parseAuthLoginForm(
        formDataFrom({
          identifier: "",
          password: "secret123",
        }),
      ),
    ).toThrow("Username or email is required.");
  });

  it("rejects mismatched register passwords", () => {
    expect(() =>
      parseAuthRegisterForm(
        formDataFrom({
          username: "raluca",
          email: "raluca@example.com",
          password: "secret123",
          confirmPassword: "other123",
        }),
      ),
    ).toThrow("Passwords do not match.");
  });

  it("parses custom expense shares", () => {
    const parsed = parseExpenseForm(
      formDataFrom({
        title: "Internet",
        amount: "120",
        category: "utilities",
        date: "2026-04-23",
        paidByUserId: "1",
        splitType: "custom",
        memberIds: "1,2",
        shares: "1:70\n2:50",
      }),
    );

    expect(parsed).toMatchObject({
      title: "Internet",
      amount: 120,
      splitType: "custom",
      memberIds: [1, 2],
      shares: [
        { userId: 1, amount: 70 },
        { userId: 2, amount: 50 },
      ],
    });
  });

  it("rejects invalid custom share format", () => {
    expect(() =>
      parseExpenseForm(
        formDataFrom({
          title: "Internet",
          amount: "120",
          category: "utilities",
          date: "2026-04-23",
          paidByUserId: "1",
          splitType: "custom",
          memberIds: "1,2",
          shares: "1:abc",
        }),
      ),
    ).toThrow("Each custom share must look like userId:amount and use a non-negative value.");
  });

  it("parses settlement with optional note", () => {
    const parsed = parseSettlementForm(
      formDataFrom({
        fromUserId: "2",
        toUserId: "1",
        amount: "30",
        note: "partial",
      }),
    );

    expect(parsed).toEqual({
      fromUserId: 2,
      toUserId: 1,
      amount: 30,
      note: "partial",
    });
  });

  it("rejects invalid expense category and non-positive numbers", () => {
    expect(() =>
      parseExpenseForm(
        formDataFrom({
          title: "Internet",
          amount: "0",
          category: "utilities",
          date: "2026-04-23",
          paidByUserId: "1",
          splitType: "equal",
          memberIds: "1,2",
          shares: "",
        }),
      ),
    ).toThrow("Amount must be a positive number.");

    expect(() =>
      parseExpenseForm(
        formDataFrom({
          title: "Internet",
          amount: "120",
          category: "invalid",
          date: "2026-04-23",
          paidByUserId: "1",
          splitType: "equal",
          memberIds: "1,2",
          shares: "",
        }),
      ),
    ).toThrow("Choose a valid expense category.");
  });

  it("omits settlement note when blank", () => {
    const parsed = parseSettlementForm(
      formDataFrom({
        fromUserId: "2",
        toUserId: "1",
        amount: "30",
        note: "   ",
      }),
    );

    expect(parsed.note).toBeUndefined();
  });
});
