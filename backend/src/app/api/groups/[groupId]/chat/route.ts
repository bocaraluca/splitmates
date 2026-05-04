import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/splitmates/services/auth/session-service';
import { getMessages } from '@/lib/splitmates/services/chat-service';

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

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('pageSize') || '50');

        if (Number.isNaN(page) || Number.isNaN(pageSize) || page < 1 || pageSize < 1 || pageSize > 100) {
            return NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 });
        }

        try {
            const result = await getMessages(groupId, page, pageSize, currentUser.id);
            return NextResponse.json(result);
        } catch (err: any) {
            if (err && err.code === 'FORBIDDEN') {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            if (err && String(err.message) === 'Group not found') {
                return NextResponse.json({ error: 'Group not found' }, { status: 404 });
            }
            throw err;
        }
    } catch (error) {
        console.error('Error fetching chat history:', error);
        return NextResponse.json(
            { error: 'Failed to fetch chat history', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}