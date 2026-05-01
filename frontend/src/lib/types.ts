export type Id = number;

export const GROUP_CATEGORIES = ["household", "trip", "friends", "roommates", "other"] as const;
export const EXPENSE_CATEGORIES = ["rent", "groceries", "utilities", "transport", "entertainment", "food", "other"] as const;
export const SPLIT_TYPES = ["equal", "custom"] as const;

export type GroupCategory = (typeof GROUP_CATEGORIES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type SplitType = (typeof SPLIT_TYPES)[number];

export interface User {
  id: Id;
  username: string;
  email: string;
  createdAt: string;
}

export interface UserBalance {
  userId: Id;
  username: string;
  email: string;
  amount: number;
}

export interface BalanceSummary {
  totalSpent: number;
  totalYouOwe: number;
  totalOwedToYou: number;
  net: number;
  youOweTo: UserBalance[];
  othersOweToYou: UserBalance[];
}

export interface GroupBalance extends BalanceSummary {
  groupId: Id;
  groupName: string;
  category: GroupCategory;
}

export interface DashboardSummary {
  user: User;
  overall: BalanceSummary;
  groups: GroupBalance[];
}

export interface GroupSummary {
  id: Id;
  name: string;
  description?: string;
  category: GroupCategory;
  createdAt: string;
  updatedAt: string;
  memberIds: Id[];
  adminIds: Id[];
  members: Array<User | null>;
  admins: Array<User | null>;
  isMember: boolean;
  isAdmin: boolean;
}

export interface GroupDetail extends GroupSummary {
  dashboard: DashboardSummary | null;
}

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

export interface ExpenseListItem {
  id: Id;
  title: string;
  amount: number;
  currency: "RON";
  date: string;
  paidBy: User | null;
  category: ExpenseCategory;
  splitType: SplitType;
}

export interface ExpenseListResponse {
  items: ExpenseListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ExpenseDetail {
  expense: Expense;
  payer: User | null;
  shares: Array<ExpenseShare & { user: User | null; percent: number }>;
  yourShare: number;
}

export interface Settlement {
  id: Id;
  groupId: Id;
  fromUserId: Id;
  toUserId: Id;
  amount: number;
  note?: string;
  date: string;
  createdAt: string;
}

export interface CategoryStat {
  category: ExpenseCategory;
  amount: number;
  percentage: number;
}

export interface MonthStat {
  month: string;
  amount: number;
}

export interface GroupStats {
  group: GroupSummary;
  totalSpent: number;
  mostExpensiveCategory: ExpenseCategory | null;
  topCategoryAmount: number;
  categories: CategoryStat[];
  months: MonthStat[];
  balance: BalanceSummary;
}

export interface GeneratorStatus {
  running: boolean;
  intervalMs: number;
  generatedCount: number;
  groupId: Id | null;
}

export interface BackendStatus {
  ok: boolean;
  users: number;
  groups: number;
  expenses: number;
  settlements: number;
  generator: GeneratorStatus;
}

export interface LoginResponse {
  token: string;
  user: User;
}
