import { faker } from "@faker-js/faker";
import type { Id, ExpenseCategory } from "@/lib/splitmates/model";
import { createExpense } from "@/lib/splitmates/services/expenses";
import { emitEvent } from "@/lib/splitmates/core/events";
import { findGroupById, getState } from "@/lib/splitmates/core/state";
import { GENERATOR_INTERVAL_MS } from "./constants";
import { getGeneratorStatus } from "./status";

function currentGeneratorGroup() {
  const state = getState();
  const configuredGroup = state.generator.groupId != null ? findGroupById(state.generator.groupId) : null;
  return configuredGroup ?? state.groups[0] ?? null;
}

function createFakeExpense() {
  const state = getState();
  const group = currentGeneratorGroup();
  if (!group || group.memberIds.length === 0) {
    return null;
  }

  const payerId = faker.helpers.arrayElement(group.memberIds);
  const amount = Math.round((faker.number.int({ min: 1500, max: 50000 }) / 100) * 100) / 100;
  const category = faker.helpers.arrayElement<ExpenseCategory>([
    "rent",
    "groceries",
    "utilities",
    "transport",
    "entertainment",
    "food",
    "other",
  ]);

  const expense = createExpense(group.id, payerId, {
    title: faker.commerce.productName(),
    amount,
    currency: "RON",
    category,
    date: faker.date.recent({ days: 180 }).toISOString(),
    paidByUserId: payerId,
    splitType: "equal",
    memberIds: group.memberIds,
    shares: [],
  });

  state.generator.generatedCount += 1;
  emitEvent("generator.expenseCreated", expense);
  return expense;
}

export function startGenerator(groupId?: Id | null) {
  const state = getState();
  if (groupId) {
    const group = findGroupById(groupId);
    if (!group) {
      throw new Error("Group not found.");
    }

    state.generator.groupId = group.id;
  }

  if (state.generator.running) {
    return getGeneratorStatus();
  }

  state.generator.running = true;
  state.generator.timer = setInterval(() => {
    createFakeExpense();
  }, GENERATOR_INTERVAL_MS);

  emitEvent("generator.started", getGeneratorStatus());
  return getGeneratorStatus();
}

export function stopGenerator() {
  const state = getState();
  if (state.generator.timer) {
    clearInterval(state.generator.timer);
    state.generator.timer = null;
  }

  state.generator.running = false;
  emitEvent("generator.stopped", getGeneratorStatus());
  return getGeneratorStatus();
}
