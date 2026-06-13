import type { GroupCategory, ExpenseCategory } from "./enums";
import type { Id } from "./ids";
import type { GroupRecord } from "./groups";
import type { User } from "./users";

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
  group: GroupRecord;
  totalSpent: number;
  mostExpensiveCategory: ExpenseCategory | null;
  topCategoryAmount: number;
  categories: CategoryStat[];
  months: MonthStat[];
  balance: BalanceSummary;
}
