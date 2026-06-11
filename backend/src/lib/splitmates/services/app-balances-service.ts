import { prisma } from "@/lib/prisma";

const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; 

function getFromCache(key: string) {
    const cache_entry = cache.get(key);
    if (cache_entry && cache_entry.timestamp > Date.now() - CACHE_TTL) {
        return cache_entry.data;
    }

    cache.delete(key);
    return null;
}

function setCache(key: string, data: any) {
    cache.set(key, { data, timestamp: Date.now() });
}

export async function getAppBalancesNoCache() {
    const start = Date.now();

    const expenses = await prisma.expense.findMany({
        include: { participants: true }
    });
    const payments = await prisma.payment.findMany();

    const balanceMap = new Map<string, number>();
    let totalParticipants = 0;

    for (const expense of expenses) {
        const paidById = Number(expense.paidByUserId);

        for (const participant of expense.participants) {
            totalParticipants++;
            const userId = Number(participant.userId);
            if (userId === paidById) {
                continue;
            }

            const key = `${userId}:${paidById}`;
            balanceMap.set(key, (balanceMap.get(key) ?? 0) + parseFloat(String(participant.amount)));
        }
    }

    for (const payment of payments) {
        const key = `${Number(payment.fromUserId)}:${Number(payment.toUserId)}`;
        balanceMap.set(key, (balanceMap.get(key) ?? 0) - parseFloat(String(payment.amount)));
    }

    const debts = [];
    for (const [key, amount] of balanceMap.entries()) {
        if (Math.abs(amount) < 0.005) {
            continue;
        }

        const [fromUserId, toUserId] = key.split(":").map(Number);
        debts.push({ fromUserId, toUserId, amount: Math.round(amount * 100) / 100 });
    }

    return {
        mode: "no-cache",
        cacheHit: false,
        durationMs: Date.now() - start,
        totalExpenses: expenses.length,
        totalParticipants,
        totalPayments: payments.length,
        totalDebts: debts.length,
        debts,
    };
}

export async function getAppBalancesOptimized() {
    const cached = getFromCache("app_balances");
    if (cached) {
        return { ...cached, mode: "cache", cacheHit: true, durationMs: 0 };
    }

    const start = Date.now();

    const expenseDebts = await prisma.$queryRaw<any[]>`
        SELECT ep."userId" AS "fromUserId", e."paidByUserId" AS "toUserId", SUM(ep."amount") AS "total_owed"
        FROM "ExpenseParticipant" ep
        JOIN "Expense" e ON ep."expenseId" = e.id
        WHERE ep."userId" != e."paidByUserId"
        GROUP BY ep."userId", e."paidByUserId"
    `;

    const paymentOffsets = await prisma.$queryRaw<any[]>`
        SELECT "fromUserId" AS "fromUserId", "toUserId" AS "toUserId", SUM("amount") AS "total_paid"
        FROM "Payment"
        GROUP BY "fromUserId", "toUserId"
    `;

    const balanceMap = new Map<string, number>();
    for (const debt of expenseDebts) {
        const key = `${Number(debt.fromUserId)}:${Number(debt.toUserId)}`;
        balanceMap.set(key, (balanceMap.get(key) ?? 0) + parseFloat(String(debt.total_owed)));
    }

    for (const payment of paymentOffsets) {
        const key = `${Number(payment.fromUserId)}:${Number(payment.toUserId)}`;
        balanceMap.set(key, (balanceMap.get(key) ?? 0) - parseFloat(String(payment.total_paid)));
    }

    const debts = [];
    for (const [key, amount] of balanceMap.entries()) {
        if (Math.abs(amount) < 0.005) {
            continue;
        }

        const [fromUserId, toUserId] = key.split(":").map(Number);
        debts.push({ fromUserId, toUserId, amount: Math.round(amount * 100) / 100 });
    }

    const [totalExpenses, totalParticipants, totalPayments] = await Promise.all([
        prisma.expense.count(),
        prisma.expenseParticipant.count(),
        prisma.payment.count(),
    ]);

    const result = {
        mode: "optimized",
        cacheHit: false,
        durationMs: Date.now() - start,
        totalExpenses,
        totalParticipants,
        totalPayments,
        totalDebts: debts.length,
        debts,
    };

    setCache("app_balances", result);
    return result;
}