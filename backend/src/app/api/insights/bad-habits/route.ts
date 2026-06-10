import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getCurrentUserFromRequest } from "@/lib/splitmates";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function getPeriodStart(period: string): Date {
  const now = new Date();
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "6months") return new Date(now.getFullYear(), now.getMonth() - 6, 1);
  if (period === "year") return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function compoundGrowth(monthly: number, annualRate: number, years: number): number {
  const r = annualRate / 12;
  const n = years * 12;
  return Math.round(monthly * ((Math.pow(1 + r, n) - 1) / r) * 100) / 100;
}

export async function GET(request: Request) {
  const actor = await getCurrentUserFromRequest(request);
  if (!actor) return jsonError("Unauthorized.", 401);

  const url = new URL(request.url);
  const period = url.searchParams.get("period") ?? "month";
  const periodStart = getPeriodStart(period);

  // Get all bad habit expenses where user is a participant
  const participations = await prisma.expenseParticipant.findMany({
    where: { userId: actor.id },
    include: {
      expense: {
        select: {
          id: true,
          title: true,
          category: true,
          date: true,
          isBadHabit: true,
          amount: true,
        },
      },
    },
  });

  const badHabitParticipations = participations.filter(
    (p) => p.expense.isBadHabit && new Date(p.expense.date) >= periodStart,
  );

  // Sum by category using participant's share
  const byCategory = new Map<string, { amount: number; count: number }>();
  let totalSpent = 0;

  for (const p of badHabitParticipations) {
    const amount = parseFloat(p.amount.toString());
    totalSpent = Math.round((totalSpent + amount) * 100) / 100;

    const cat = p.expense.category;
    const existing = byCategory.get(cat) ?? { amount: 0, count: 0 };
    byCategory.set(cat, {
      amount: Math.round((existing.amount + amount) * 100) / 100,
      count: existing.count + 1,
    });
  }

  const categoryList = Array.from(byCategory.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.amount - a.amount);

  // Investment projections (7% annual return, monthly contributions)
  const periodMonths = period === "month" ? 1 : period === "6months" ? 6 : 12;
  const monthlyAvg = Math.round((totalSpent / periodMonths) * 100) / 100;

  return jsonOk({
    period,
    periodStart: periodStart.toISOString(),
    totalSpent,
    monthlyAvg,
    byCategory: categoryList,
    projections: {
      saved: totalSpent,
      invested1Year: compoundGrowth(monthlyAvg, 0.07, 1),
      invested5Years: compoundGrowth(monthlyAvg, 0.07, 5),
      invested10Years: compoundGrowth(monthlyAvg, 0.07, 10),
      invested20Years: compoundGrowth(monthlyAvg, 0.07, 20),
    },
  });
}
