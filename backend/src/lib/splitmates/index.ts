export * from "./model/types";
export * from "./core/state";
export * from "./core/events";
export * from "./core/math";
export * from "./services/auth";
export * from "./services/groups";
export * from "./services/expenses";
export * from "./services/analytics";
export * from "./services/generator";

import {
  findExpenseById,
  findGroupById,
  findSettlementById,
  findUserByIdentifier,
  findUserById,
  getUsers,
  toUser,
} from "./core/state";

export function getUserById(userId: number) {
  return toUser(findUserById(userId));
}

export function getUserByIdentifier(identifier: string) {
  return toUser(findUserByIdentifier(identifier));
}

export function getUserRecordByIdentifier(identifier: string) {
  return findUserByIdentifier(identifier);
}

export function getUserRecordById(userId: number) {
  return findUserById(userId);
}

export function getGroupById(groupId: number) {
  return findGroupById(groupId);
}

export function getExpenseById(expenseId: number) {
  return findExpenseById(expenseId);
}

export function getSettlementById(settlementId: number) {
  return findSettlementById(settlementId);
}

export function getSeedUsers() {
  return getUsers();
}
