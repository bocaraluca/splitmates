import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ChatMessage } from '@/lib/models/ChatMessage';
import { getCurrentUserFromRequest } from '@/lib/splitmates/services/auth/session-service';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ groupId: string }> }
) {
    try {
        const { groupId: groupIdParam } = await params;
        console.log('Chat history request:', { groupId: groupIdParam });
        
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

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('pageSize') || '50');

        if (Number.isNaN(page) || Number.isNaN(pageSize) || page < 1 || pageSize < 1 || pageSize > 100) {
            return NextResponse.json(
                { error: 'Invalid pagination parameters' },
                { status: 400 }
            );
        }

        const skip = (page - 1) * pageSize;
        console.log(`Querying MongoDB for groupId=${groupId}, page=${page}, skip=${skip}`);
        
        const [messages, totalMessages] = await Promise.all([
            ChatMessage.find({ groupId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageSize)
                .lean(),
            ChatMessage.countDocuments({ groupId }),
        ]);

        console.log(`Retrieved ${messages.length} messages, total: ${totalMessages}`);

        const orderedMessages = messages
            .reverse()
            .map((message) => ({
                id: message._id.toString(),
                groupId: message.groupId,
                userId: message.userId,
                username: message.username,
                content: message.content,
                createdAt: message.createdAt.toISOString(),
            }));

        return NextResponse.json({
            messages: orderedMessages,
            totalMessages,
            page,
            pageSize,
            totalPages: Math.ceil(totalMessages / pageSize),
        });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        return NextResponse.json(
            { error: 'Failed to fetch chat history', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}