export const GROUP_CATEGORIES = ["household", "trip", "friends", "family", "roommates", "other"] as const;

export const EXPENSE_CATEGORIES = [
  "rent",
  "groceries",
  "utilities",
  "transport",
  "entertainment",
  "food",
  "other",
  "alcohol",
  "gambling",
  "smoking",
  "fast_food",
  "luxury",
  "online_shopping",
  "subscriptions",
] as const;

export type GroupCategory = (typeof GROUP_CATEGORIES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type SplitType = "equal" | "custom";

