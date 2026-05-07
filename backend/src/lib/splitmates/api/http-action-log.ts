import { randomUUID } from 'node:crypto';
import { getCurrentUserFromRequest } from '@/lib/splitmates/services/auth/session-service';
import { createLog, LogOutcome } from '@/lib/splitmates/services/logging-service';
import type { ActionType } from '@/lib/splitmates/logging/action-types';

type LogHttpActionInput = {
  request: Request;
    actionType: ActionType;
  outcome: LogOutcome;
  groupId?: number | null;
  actionJson?: unknown;
  fallbackUserId?: number | null;
};

function getRequestId(request: Request) : string {
    const existingRequestId = request.headers.get('x-request-id')?.trim();
    return existingRequestId && existingRequestId.length > 0 ? existingRequestId : randomUUID();
}

function getClientIp(request: Request): string | null {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim() || null;
    }

    return request.headers.get('x-real-ip')?.trim() || null;
}

function getClientInfo(request: Request): string | null {
    return request.headers.get('user-agent')?.trim() || null;
}

export async function logHttpAction({
    request,
    actionType,
    outcome,
    groupId = null,
    actionJson,
    fallbackUserId = null,
}: LogHttpActionInput) {
    try {
        const currentUser = await getCurrentUserFromRequest(request, fallbackUserId);
        if (!currentUser) {
            return null;
        }

        return await createLog({
            userId: currentUser.id,
            groupId,
            roleId: currentUser.roleId ?? null,
            roleTitle: null,
            actionType,
            actionJson: (actionJson ?? null) as any,
            ip: getClientIp(request),
            clientInfo: getClientInfo(request),
            requestId: getRequestId(request),
            outcome,
        });
    }
    catch {
        return null;
    }
}