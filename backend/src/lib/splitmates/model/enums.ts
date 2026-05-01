export const GROUP_CATEGORIES = ["household", "trip", "friends", "roommates", "other"] as const;

export const EXPENSE_CATEGORIES = [
  "rent",
  "groceries",
  "utilities",
  "transport",
  "entertainment",
  "food",
  "other",
] as const;

export type GroupCategory = (typeof GROUP_CATEGORIES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type SplitType = "equal" | "custom";
