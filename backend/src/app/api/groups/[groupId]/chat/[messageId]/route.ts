import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ChatMessage } from '@/lib/models/ChatMessage';
import { getCurrentUserFromRequest } from '@/lib/splitmates/services/auth/session-service';
import { logHttpAction } from '@/lib/splitmates/api/http-action-log';
import ACTION_TYPES from '@/lib/splitmates/logging/action-types';
import { LogOutcome } from '@/lib/splitmates/services/logging-service';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ groupId: string; messageId: string }> }
) {
    try {
        const { groupId: groupIdParam, messageId } = await params;
        const groupId = parseInt(groupIdParam);
        if (Number.isNaN(groupId) || groupId <= 0) {
            void logHttpAction({
                request,
                actionType: ACTION_TYPES.GROUP_CHAT_MESSAGE_DELETE_INVALID_GROUP_ID,
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
                actionType: ACTION_TYPES.GROUP_CHAT_MESSAGE_DELETE_UNAUTHORIZED,
                outcome: LogOutcome.failed,
                groupId: undefined,
            });

            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: { members: true },
        });

        if (!group) {
            void logHttpAction({
                request,
                actionType: ACTION_TYPES.GROUP_CHAT_MESSAGE_DELETE_NOT_FOUND,
                outcome: LogOutcome.not_found,
                groupId: groupId ?? undefined,
                fallbackUserId: currentUser.id,
            });

            return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        }

        const isGroupMember = group.members.some((member) => member.userId === currentUser.id);

        if (!isGroupMember) {
            void logHttpAction({
                request,
                actionType: ACTION_TYPES.GROUP_CHAT_MESSAGE_DELETE_FORBIDDEN,
                outcome: LogOutcome.forbidden,
                groupId: groupId ?? undefined,
                fallbackUserId: currentUser.id,
            });

            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const message = await ChatMessage.findById(messageId);

        if (!message) {
            void logHttpAction({
                request,
                actionType: ACTION_TYPES.GROUP_CHAT_MESSAGE_DELETE_NOT_FOUND,
                outcome: LogOutcome.not_found,
                groupId: groupId ?? undefined,
                fallbackUserId: currentUser.id,
                actionJson: { messageId },
            });

            return NextResponse.json({ error: 'Message not found' }, { status: 404 });
        }

        if (message.groupId !== groupId) {
            void logHttpAction({
                request,
                actionType: ACTION_TYPES.GROUP_CHAT_MESSAGE_DELETE_FAILED,
                outcome: LogOutcome.validation_error,
                groupId: groupId ?? undefined,
                fallbackUserId: currentUser.id,
                actionJson: { messageId },
            });

            return NextResponse.json({ error: 'Message not in this group' }, { status: 400 });
        }

        if (message.userId !== currentUser.id) {
            void logHttpAction({
                request,
                actionType: ACTION_TYPES.GROUP_CHAT_MESSAGE_DELETE_FORBIDDEN,
                outcome: LogOutcome.forbidden,
                groupId: groupId ?? undefined,
                fallbackUserId: currentUser.id,
                actionJson: { messageId },
            });

            return NextResponse.json({ error: 'Can only delete your own messages' }, { status: 403 });
        }

        await ChatMessage.findByIdAndDelete(messageId);

        const socketIO = (globalThis as typeof globalThis & { __splitmatesSocketIO?: { to: (room: string) => { emit: (event: string, payload: { messageId: string; timestamp: string }) => void } } }).__splitmatesSocketIO;

        if (socketIO) {
            socketIO.to(`group_${groupId}`).emit('message:deleted', {
                messageId,
                timestamp: new Date().toISOString(),
            });
        }

        void logHttpAction({
            request,
            actionType: ACTION_TYPES.GROUP_CHAT_MESSAGE_DELETE,
            outcome: LogOutcome.success,
            groupId: groupId ?? undefined,
            actionJson: { messageId },
            fallbackUserId: currentUser.id,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting chat message:', error);
        void logHttpAction({
            request,
            actionType: ACTION_TYPES.GROUP_CHAT_MESSAGE_DELETE_FAILED,
            outcome: LogOutcome.failed,
            groupId: undefined,
            actionJson: { error: error instanceof Error ? error.message : String(error) },
        });

        return NextResponse.json(
            { error: 'Failed to delete chat message' },
            { status: 500 }
        );
    }
}