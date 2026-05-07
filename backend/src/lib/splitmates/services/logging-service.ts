import { LogActionType, LogOutcome, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ActionType } from '@/lib/splitmates/logging/action-types';
import { evaluateLogForSuspiciousActivity } from '@/lib/splitmates/services/suspicious-user-service';

export { LogOutcome };

export type LogInput = {
    userId: number;
    groupId?: number | null;
    roleId?: number | null;
    roleTitle?: string | null;
    actionType: ActionType;
    actionJson?: Prisma.InputJsonValue | null;
    ip?: string | null;
    clientInfo?: string | null;
    requestId?: string | null;
    outcome?: LogOutcome | null;
    createdAt?: Date;
};

export type LogQueryFilters = {
    userId?: number;
    user?: string;
    groupId?: number;
    roleId?: number;
    actionType?: ActionType;
    outcome?: LogOutcome;
    from?: Date;
    to?: Date;
};

export type LogQueryOptions = {
    page?: number;
    pageSize?: number;
};

function normalizeString(value?: string | null): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeActionType(actionType: ActionType): ActionType {
    const normalized = actionType.trim();
    if (!normalized) {
        throw new Error('actionType is required');
    }
    return normalized as ActionType;
}

function validateDateRange(from?: Date, to?: Date) {
    if (from && to && from.getTime() > to.getTime()) {
        throw new Error('Invalid date range: `from` must be earlier than or equal to `to`');
    }
}

export async function createLog(log: LogInput) {
    const actionType = normalizeActionType(log.actionType);

    try {
        const createdLog = await prisma.log.create({
            data: {
                userId: log.userId,
                groupId: log.groupId ?? null,
                roleId: log.roleId ?? null,
                roleTitle: normalizeString(log.roleTitle),
                actionType: actionType as LogActionType,
                actionJson: log.actionJson ?? undefined,
                ip: normalizeString(log.ip),
                clientInfo: normalizeString(log.clientInfo),
                requestId: normalizeString(log.requestId),
                outcome: log.outcome ?? null,
                createdAt: log.createdAt ?? undefined,
            },
        });

        try {
            await evaluateLogForSuspiciousActivity(createdLog);
        } catch (detectionError) {
            console.error('Suspicious activity evaluation failed:', detectionError);
        }

        return createdLog;
    } catch (error: unknown) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            return null;
        }
        throw error;
    }
}

export async function createMultipleLogs(logs: LogInput[]) {
    if (!logs.length) {
        return { count: 0 };
    }

    const missingRequestIdIndex = logs.findIndex((log) => !normalizeString(log.requestId));
    if (missingRequestIdIndex !== -1) {
        throw new Error(
            `requestId is required for createMultipleLogs when skipDuplicates is enabled (missing at index ${missingRequestIdIndex})`
        );
    }

    const data = logs.map((log) => ({
        userId: log.userId,
        groupId: log.groupId ?? null,
        roleId: log.roleId ?? null,
        roleTitle: normalizeString(log.roleTitle),
        actionType: normalizeActionType(log.actionType) as LogActionType,
        actionJson: log.actionJson ?? undefined,
        ip: normalizeString(log.ip),
        clientInfo: normalizeString(log.clientInfo),
        requestId: normalizeString(log.requestId),
        outcome: log.outcome ?? null,
        createdAt: log.createdAt ?? new Date(),
    }));

    return prisma.log.createMany({
        data,
        skipDuplicates: true,
    });
}

export async function getLogs(
    filters: LogQueryFilters = {},
    options: LogQueryOptions = {}
) {
    validateDateRange(filters.from, filters.to);

    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, options.pageSize ?? 50));
    const skip = (page - 1) * pageSize;

    const where: Prisma.LogWhereInput = {
        groupId: filters.groupId,
        roleId: filters.roleId,
        actionType: filters.actionType
            ? (normalizeActionType(filters.actionType) as LogActionType)
            : undefined,
        outcome: filters.outcome,
        createdAt:
            filters.from || filters.to
                ? {
                        gte: filters.from,
                        lte: filters.to,
                    }
                : undefined,
    };

    // apply numeric userId filter if provided
    if (typeof filters.userId === 'number') {
        where.userId = filters.userId;
    }

    // apply username/email search across related user when `user` filter is provided
    if (typeof filters.user === 'string' && filters.user.trim().length > 0) {
        const q = filters.user.trim();
        const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
        where.AND = [
            ...existingAnd,
            {
                OR: [
                    { user: { username: { contains: q, mode: 'insensitive' } } },
                    { user: { email: { contains: q, mode: 'insensitive' } } },
                ],
            },
        ];
    }

    const [items, total] = await Promise.all([
        prisma.log.findMany({
            where,
            include: { user: { select: { username: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            skip,
            take: pageSize,
        }),
        prisma.log.count({ where }),
    ]);

    return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    };
}

export async function deleteLogsOlderThanDays(days: number) {
    if (!Number.isFinite(days) || days <= 0) {
        throw new Error('days must be a positive number');
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return prisma.log.deleteMany({
        where: {
            createdAt: { lt: cutoff },
        },
    });
}

export default {
    createLog,
    createMultipleLogs,
    getLogs,
    deleteLogsOlderThanDays,
};