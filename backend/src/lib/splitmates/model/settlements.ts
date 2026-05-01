import type { Id } from "./ids";

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
