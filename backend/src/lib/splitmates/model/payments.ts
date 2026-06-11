import type { Id } from "./ids";

export interface Payment {
  id: Id;
  groupId: Id;
  fromUserId: Id;
  toUserId: Id;
  amount: number;
  note?: string;
  date: string;
  createdAt: string;
}
