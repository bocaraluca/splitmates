import type { ExpenseCategory, SplitType } from "./enums";
import type { Id } from "./ids";
import type { User } from "./users";

export interface ExpenseShare {
  userId: Id;
  amount: number;
}

export interface Expense {
  id: Id;
  groupId: Id;
  title: string;
  amount: number;
  currency: "RON";
  category: ExpenseCategory;
  date: string;
  paidByUserId: Id;
  splitType: SplitType;
  memberIds: Id[];
  shares: ExpenseShare[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseDetail {
  expense: Expense;
  payer: User | null;
  shares: Array<ExpenseShare & { user: User | null; percent: number }>;
  yourShare: number;
}

export interface ExpenseListItem {
  id: Id;
  title: string;
  amount: number;
  currency: "RON";
  date: string;
  paidBy: User | null;
  category: ExpenseCategory;
  splitType: SplitType;
  isBadHabit: boolean;
}

export interface ExpenseListResponse {
  items: ExpenseListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

