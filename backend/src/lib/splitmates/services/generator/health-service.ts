import { prisma } from "@/lib/prisma";
import { getGeneratorStatus } from "./status-service";

export async function getHealthSnapshot() {
  const [users, groups, expenses, payments] = await Promise.all([
    prisma.user.count(),
    prisma.group.count(),
    prisma.expense.count(),
    prisma.payment.count(),
  ]);

  return {
    users,
    groups,
    expenses,
    payments,
    generator: getGeneratorStatus(),
  };
}
