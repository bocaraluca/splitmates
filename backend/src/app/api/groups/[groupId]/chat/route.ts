import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/splitmates/services/auth/session-service';
import { getMessages } from '@/lib/splitmates/services/chat-service';
import { logHttpAction } from '@/lib/splitmates/api/http-action-log';
import { LogOutcome } from '@/lib/splitmates/services/logging-service';
import ACTION_TYPES from '@/lib/splitmates/logging/action-types';

export async function GET(
    request: Request,
    { params }: { params: { groupId: string } | Promise<{ groupId: string }> }
) {
    let groupId: number | null = null;

    try {
        const { groupId: groupIdParam } = await params;
        groupId = parseInt(groupIdParam, 10);
        
        if (Number.isNaN(groupId) || groupId <= 0) {
            void logHttpAction({
                request,
                actionType: ACTION_TYPES.GROUP_CHAT_HISTORY_GET_INVALID_GROUP_ID,
                outcome: LogOutcome.validation_error,
                groupId: undefined,
                actionJson: { groupId: groupIdParam },
            });

            return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
        }

        const currentUser = await getCurrentUserFromRequest(request);
        if (!currentUser) {
            void logHttpAction({
                request,
                actionType: ACTION_TYPES.GROUP_CHAT_HISTORY_GET_UNAUTHORIZED,
                outcome: LogOutcome.failed,
                groupId: undefined,
            });

            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(request.url);
        const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
        const pageSize = Number.parseInt(url.searchParams.get('pageSize') ?? '50', 10);
    
        if (Number.isNaN(page) || Number.isNaN(pageSize) || page < 1 || pageSize < 1 || pageSize > 100) {
            void logHttpAction({
                request,
                actionType: ACTION_TYPES.GROUP_CHAT_HISTORY_GET_INVALID_PAGINATION,
                outcome: LogOutcome.validation_error,
                groupId: groupId ?? undefined,
                actionJson: { page: url.searchParams.get('page'), pageSize: url.searchParams.get('pageSize') },
                fallbackUserId: currentUser.id,
            });

            return NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 });
        }

        try {
            const result = await getMessages(groupId, page, pageSize, currentUser.id);

            void logHttpAction({
                request,
                actionType: ACTION_TYPES.GROUP_CHAT_HISTORY_GET,
                outcome: LogOutcome.success,
                groupId: groupId ?? undefined,
                actionJson: { page, pageSize },
                fallbackUserId: currentUser.id,
            });

            return NextResponse.json(result);
        } catch (err: any) {
            if (err?.code === 'FORBIDDEN') {
                void logHttpAction({
                    request,
                    actionType: ACTION_TYPES.GROUP_CHAT_HISTORY_GET_FORBIDDEN,
                    outcome: LogOutcome.forbidden,
                    groupId: groupId ?? undefined,
                    fallbackUserId: currentUser.id,
                });

                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            if (String(err?.message) === 'Group not found') {
                void logHttpAction({
                    request,
                    actionType: ACTION_TYPES.GROUP_CHAT_HISTORY_GET_NOT_FOUND,
                    outcome: LogOutcome.not_found,
                    groupId: groupId ?? undefined,
                    fallbackUserId: currentUser.id,
                });

                return NextResponse.json({ error: 'Group not found' }, { status: 404 });
            }

            throw err;
        }
    }
    catch (error) {
        void logHttpAction({
            request,
            actionType: ACTION_TYPES.GROUP_CHAT_HISTORY_GET_FAILED,
            outcome: LogOutcome.failed,
            groupId: groupId ?? undefined,
            actionJson: { error: error instanceof Error ? error.message : String(error) },
        });

        return NextResponse.json(
      { error: 'Failed to fetch chat history', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
    }
}