import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ChatMessage } from '@/lib/models/ChatMessage';
import { getCurrentUserFromRequest } from '@/lib/splitmates/services/auth/session-service';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ groupId: string; messageId: string }> }
) {
    try {
        const { groupId: groupIdParam, messageId } = await params;
        const groupId = parseInt(groupIdParam);
        if (Number.isNaN(groupId) || groupId <= 0) {
            return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
        }

        const currentUser = await getCurrentUserFromRequest(request);

        if (!currentUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: { members: true },
        });

        if (!group) {
            return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        }

        const isGroupMember = group.members.some((member) => member.userId === currentUser.id);

        if (!isGroupMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const message = await ChatMessage.findById(messageId);

        if (!message) {
            return NextResponse.json({ error: 'Message not found' }, { status: 404 });
        }

        if (message.groupId !== groupId) {
            return NextResponse.json({ error: 'Message not in this group' }, { status: 400 });
        }

        if (message.userId !== currentUser.id) {
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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting chat message:', error);
        return NextResponse.json(
            { error: 'Failed to delete chat message' },
            { status: 500 }
        );
    }
}