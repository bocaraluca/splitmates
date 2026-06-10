import { faker } from "@faker-js/faker";
import type { Id, ExpenseCategory } from "@/lib/splitmates/model";
import { prisma } from "@/lib/prisma";
import { createExpense } from "@/lib/splitmates/services/expenses-service";
import { emitEvent } from "@/lib/splitmates/core/events";
import { getState } from "@/lib/splitmates/core/state";
import { getGeneratorStatus } from "./status-service";

const GENERATOR_INTERVAL_MS = 1500;

async function pickGeneratorGroup() {
  const state = getState();

  if (state.generator.groupId != null) {
    const configured = await prisma.group.findUnique({
      where: { id: state.generator.groupId },
      include: { members: true },
    });
    if (configured) {
      return configured;
    }
  }

  return prisma.group.findFirst({
    include: { members: true },
  });
}

async function createFakeExpense() {
  const state = getState();
  const group = await pickGeneratorGroup();
  if (!group || group.members.length === 0) {
    return null;
  }

  const memberIds = group.members.map((member) => member.userId);
  const payerId = faker.helpers.arrayElement(memberIds);
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

  const expense = await createExpense(group.id, payerId, {
    title: faker.commerce.productName(),
    amount,
    currency: "RON",
    category,
    date: faker.date.recent({ days: 180 }).toISOString(),
    paidByUserId: payerId,
    splitType: "equal",
    memberIds,
    shares: [],
  }, { skipNotifications: true });

  state.generator.generatedCount += 1;
  emitEvent("generator.expenseCreated", expense);
  return expense;
}

export async function startGenerator(groupId?: Id | null) {
  const state = getState();

  if (groupId) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
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
    void createFakeExpense();
  }, GENERATOR_INTERVAL_MS);

  emitEvent("generator.started", getGeneratorStatus());
  return getGeneratorStatus();
}

export function stopGenerator() {
  const state = getState();

  // Clear timer regardless of running state — handles edge cases from hot reload
  if (state.generator.timer) {
    clearInterval(state.generator.timer);
    state.generator.timer = null;
  }

  state.generator.running = false;
  state.generator.groupId = null;
  emitEvent("generator.stopped", getGeneratorStatus());
  return getGeneratorStatus();
}
