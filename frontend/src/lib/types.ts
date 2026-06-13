export type Id = number;

export const GROUP_CATEGORIES = ["household", "trip", "friends", "family", "roommates", "other"] as const;
export const EXPENSE_CATEGORIES = ["rent", "groceries", "utilities", "transport", "entertainment", "food", "other", "alcohol", "gambling", "smoking", "fast_food", "luxury", "online_shopping", "subscriptions"] as const;
export const SPLIT_TYPES = ["equal", "custom"] as const;

export type GroupCategory = (typeof GROUP_CATEGORIES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const BAD_HABIT_CATEGORIES: ExpenseCategory[] = ["alcohol", "gambling", "smoking", "fast_food", "luxury", "online_shopping", "subscriptions"];
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
  stripeAccountId: string | null;
  amount: number;
  groupId?: Id;
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
  categoryStats: CategoryStat[];
  monthlyStats: MonthStat[];
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
  isBadHabit: boolean;
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
  role: string;
  permissions: string[];
}

export interface ChatMessage {
  id: string;
  groupId: Id;
  userId: Id;
  username: string;
  content: string;
  createdAt: string;
}

export interface ActiveUser {
  userId: Id;
  username: string;
  joinedAt?: string;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
  totalMessages: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminUser {
  id: Id;
  username: string;
  email: string;
  createdAt: string;
  role: string;
  membershipsCount: number;
  groupsCreatedCount: number;
  expensesPaidCount: number;
}

export interface AdminGroup {
  id: Id;
  name: string;
  description?: string | null;
  category: GroupCategory;
  createdAt: string;
  admins: Array<Pick<User, "id" | "username"> | null>;
  memberCount: number;
}

export interface AdminOverview {
  users: AdminUser[];
  groups: AdminGroup[];
}

export const LOG_ACTION_TYPES = [
  "GROUP_CHAT_HISTORY_GET",
  "GROUP_CHAT_HISTORY_GET_INVALID_GROUP_ID",
  "GROUP_CHAT_HISTORY_GET_UNAUTHORIZED",
  "GROUP_CHAT_HISTORY_GET_INVALID_PAGINATION",
  "GROUP_CHAT_HISTORY_GET_FORBIDDEN",
  "GROUP_CHAT_HISTORY_GET_NOT_FOUND",
  "GROUP_CHAT_HISTORY_GET_FAILED",
  "GROUP_CHAT_MESSAGE_DELETE",
  "GROUP_CHAT_MESSAGE_DELETE_INVALID_GROUP_ID",
  "GROUP_CHAT_MESSAGE_DELETE_UNAUTHORIZED",
  "GROUP_CHAT_MESSAGE_DELETE_FORBIDDEN",
  "GROUP_CHAT_MESSAGE_DELETE_NOT_FOUND",
  "GROUP_CHAT_MESSAGE_DELETE_FAILED",
  "GROUP_DETAIL_GET",
  "GROUP_DETAIL_GET_INVALID_GROUP_ID",
  "GROUP_DETAIL_GET_UNAUTHORIZED",
  "GROUP_DETAIL_GET_FORBIDDEN",
  "GROUP_DETAIL_GET_NOT_FOUND",
  "GROUP_DETAIL_GET_FAILED",
  "GROUP_DETAIL_PATCH",
  "GROUP_DETAIL_PATCH_INVALID_GROUP_ID",
  "GROUP_DETAIL_PATCH_UNAUTHORIZED",
  "GROUP_DETAIL_PATCH_NOT_FOUND",
  "GROUP_DETAIL_PATCH_FAILED",
  "GROUP_DETAIL_DELETE",
  "GROUP_DETAIL_DELETE_INVALID_GROUP_ID",
  "GROUP_DETAIL_DELETE_UNAUTHORIZED",
  "GROUP_DETAIL_DELETE_NOT_FOUND",
  "GROUP_DETAIL_DELETE_FAILED",
  "ADMIN_GROUP_DELETE",
  "ADMIN_GROUP_DELETE_INVALID_GROUP_ID",
  "ADMIN_GROUP_DELETE_UNAUTHORIZED",
  "ADMIN_GROUP_DELETE_FORBIDDEN",
  "ADMIN_GROUP_DELETE_NOT_FOUND",
  "ADMIN_GROUP_DELETE_FAILED",
  "ADMIN_OVERVIEW_GET",
  "ADMIN_OVERVIEW_GET_UNAUTHORIZED",
  "ADMIN_OVERVIEW_GET_FORBIDDEN",
  "ADMIN_OVERVIEW_GET_FAILED",
  "ADMIN_USER_DELETE",
  "ADMIN_USER_DELETE_INVALID_USER_ID",
  "ADMIN_USER_DELETE_UNAUTHORIZED",
  "ADMIN_USER_DELETE_FORBIDDEN",
  "ADMIN_USER_DELETE_NOT_FOUND",
  "ADMIN_USER_DELETE_FAILED",
  "ADMIN_USER_ROLE_UPDATE",
  "ADMIN_USER_ROLE_UPDATE_INVALID_USER_ID",
  "ADMIN_USER_ROLE_UPDATE_INVALID_ROLE",
  "ADMIN_USER_ROLE_UPDATE_UNAUTHORIZED",
  "ADMIN_USER_ROLE_UPDATE_FORBIDDEN",
  "ADMIN_USER_ROLE_UPDATE_NOT_FOUND",
  "ADMIN_USER_ROLE_UPDATE_FAILED",
  "ADMIN_LOGS_GET",
  "ADMIN_LOGS_GET_UNAUTHORIZED",
  "ADMIN_LOGS_GET_FORBIDDEN",
  "ADMIN_LOGS_GET_FAILED",
  "ADMIN_SUSPICIOUS_GET",
  "ADMIN_SUSPICIOUS_GET_UNAUTHORIZED",
  "ADMIN_SUSPICIOUS_GET_FORBIDDEN",
  "ADMIN_SUSPICIOUS_GET_FAILED",
  "ADMIN_SUSPICIOUS_PATCH",
  "ADMIN_SUSPICIOUS_PATCH_UNAUTHORIZED",
  "ADMIN_SUSPICIOUS_PATCH_FORBIDDEN",
  "ADMIN_SUSPICIOUS_PATCH_INVALID_USER_ID",
  "ADMIN_SUSPICIOUS_PATCH_NOT_FOUND",
  "ADMIN_SUSPICIOUS_PATCH_FAILED",
  "DASHBOARD_GET",
  "DASHBOARD_GET_NO_USERS",
  "DASHBOARD_GET_FAILED",
  "EVENTS_STREAM_CONNECT",
  "EVENTS_STREAM_DISCONNECT",
  "GENERATOR_START",
  "GENERATOR_START_INVALID_PAYLOAD",
  "GENERATOR_START_FAILED",
  "GENERATOR_STATUS_GET",
  "GENERATOR_STATUS_GET_FAILED",
  "GENERATOR_STOP",
  "GENERATOR_STOP_FAILED",
  "GROUPS_GET",
  "GROUPS_GET_UNAUTHORIZED",
  "GROUPS_GET_FAILED",
  "GROUPS_CREATE",
  "GROUPS_CREATE_UNAUTHORIZED",
  "GROUPS_CREATE_FAILED",
  "GROUP_MEMBERS_ADD",
  "GROUP_MEMBERS_ADD_UNAUTHORIZED",
  "GROUP_MEMBERS_ADD_INVALID_GROUP_ID",
  "GROUP_MEMBERS_ADD_FAILED",
  "GROUP_MEMBERS_REMOVE",
  "GROUP_MEMBERS_REMOVE_UNAUTHORIZED",
  "GROUP_MEMBERS_REMOVE_INVALID_GROUP_ID",
  "GROUP_MEMBERS_REMOVE_NOT_FOUND",
  "GROUP_MEMBERS_REMOVE_FAILED",
  "GROUP_EXPENSES_GET",
  "GROUP_EXPENSES_GET_INVALID_GROUP_ID",
  "GROUP_EXPENSES_GET_NOT_FOUND",
  "GROUP_EXPENSES_GET_FAILED",
  "GROUP_EXPENSES_CREATE",
  "GROUP_EXPENSES_CREATE_UNAUTHORIZED",
  "GROUP_EXPENSES_CREATE_INVALID_GROUP_ID",
  "GROUP_EXPENSES_CREATE_FAILED",
  "GROUP_EXPENSES_DETAIL_GET",
  "GROUP_EXPENSES_DETAIL_GET_INVALID_GROUP_ID",
  "GROUP_EXPENSES_DETAIL_GET_NOT_FOUND",
  "GROUP_EXPENSES_DETAIL_GET_FAILED",
  "GROUP_EXPENSES_DETAIL_PATCH",
  "GROUP_EXPENSES_DETAIL_PATCH_UNAUTHORIZED",
  "GROUP_EXPENSES_DETAIL_PATCH_INVALID_GROUP_ID",
  "GROUP_EXPENSES_DETAIL_PATCH_NOT_FOUND",
  "GROUP_EXPENSES_DETAIL_PATCH_FAILED",
  "GROUP_EXPENSES_DETAIL_DELETE",
  "GROUP_EXPENSES_DETAIL_DELETE_UNAUTHORIZED",
  "GROUP_EXPENSES_DETAIL_DELETE_INVALID_GROUP_ID",
  "GROUP_EXPENSES_DETAIL_DELETE_NOT_FOUND",
  "GROUP_EXPENSES_DETAIL_DELETE_FAILED",
  "GROUP_STATS_GET",
  "GROUP_STATS_GET_INVALID_GROUP_ID",
  "GROUP_STATS_GET_NOT_FOUND",
  "GROUP_STATS_GET_FAILED",
  "GROUP_PAYMENTS_GET",
  "GROUP_PAYMENTS_GET_INVALID_GROUP_ID",
  "GROUP_PAYMENTS_GET_NOT_FOUND",
  "GROUP_PAYMENTS_GET_FAILED",
  "GROUP_PAYMENTS_CREATE",
  "GROUP_PAYMENTS_CREATE_UNAUTHORIZED",
  "GROUP_PAYMENTS_CREATE_INVALID_GROUP_ID",
  "GROUP_PAYMENTS_CREATE_FAILED",
  "GROUP_LEAVE",
  "GROUP_LEAVE_UNAUTHORIZED",
  "GROUP_LEAVE_INVALID_GROUP_ID",
  "GROUP_LEAVE_FAILED",
  "AUTH_LOGIN_SUCCESS",
  "AUTH_LOGIN_FAILED",
  "AUTH_LOGOUT",
  "AUTH_LOGOUT_FAILED",
  "AUTH_SIGNUP_SUCCESS",
  "AUTH_SIGNUP_FAILED",
] as const;

export type LogActionTypeValue = (typeof LOG_ACTION_TYPES)[number];

export type AdminLogEntry = {
  id: string;
  userId: number;
  user?: { username: string; email: string } | null;
  groupId: number | null;
  roleId: number | null;
  roleTitle: string | null;
  actionType: LogActionTypeValue;
  actionJson: unknown;
  ip: string | null;
  clientInfo: string | null;
  requestId: string | null;
  outcome: string | null;
  createdAt: string;
};

export interface AdminLogsResponse {
  logs: AdminLogEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type SuspiciousStatus = "watching" | "underReview" | "cleared";

export interface AdminSuspiciousRule {
  id: number;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  weight: number;
  params: unknown;
}

export interface AdminSuspiciousObservation {
  id: number;
  suspiciousUserId: number;
  ruleId: number | null;
  logId: string | null;
  scoreIncrease: number;
  note: string | null;
  actionJson: unknown;
  createdAt: string;
  rule: AdminSuspiciousRule | null;
}

export interface AdminSuspiciousAlert {
  id: number;
  suspiciousUserId: number;
  severity: "low" | "medium" | "high";
  title: string;
  message: string;
  resolvedAt: string | null;
  createdAt: string;
}

export interface AdminSuspiciousUser {
  userId: number;
  reason: string | null;
  flaggedAt: string;
  user: {
    username: string;
    email: string;
  };
  observations: Array<{
    ruleKey: string;
    note: string;
    createdAt: string;
  }>;
}

export interface AdminSuspiciousResponse {
  suspiciousUsers: AdminSuspiciousUser[];
}

export interface AppStatsDebt {
  fromUserId: number;
  toUserId: number;
  amount: number;
}

export interface AppStatsResult {
  mode: "no-cache" | "optimized" | "cache";
  cacheHit: boolean;
  durationMs: number;
  totalExpenses: number;
  totalParticipants: number;
  totalPayments: number;
  totalDebts: number;
  debts: AppStatsDebt[];
}
