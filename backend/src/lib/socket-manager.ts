import { Server as SocketIOServer } from 'socket.io';
import { connectToMongoDB } from './mongodb.ts';
import { prisma } from './prisma.ts';
import { createMessage, deleteMessage } from '@/lib/splitmates/services/chat-service';
import type { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

const activeUsers = new Map<number, Set<number>>();  // groupId -> set of active userIds in that group

export async function initializeSocket(server: HTTPServer) {
  try {
    await connectToMongoDB();
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    throw error;
  }

  const corsOrigin = process.env.FRONTEND_URL || '*';

  io = new SocketIOServer(server, {
    cors: {
      origin: corsOrigin === '*' ? '*' : [corsOrigin],
      credentials: corsOrigin !== '*',
    },
  });

  (globalThis as typeof globalThis & { __splitmatesSocketIO?: SocketIOServer }).__splitmatesSocketIO = io;

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        console.error('No token provided in Socket.IO handshake');
        return next(new Error('No token provided'));
      }

      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!session) {
        console.error('Session not found for token');
        return next(new Error('Invalid or expired token'));
      }

      if (new Date() > session.expiresAt) {
        console.error('Session expired');
        return next(new Error('Invalid or expired token'));
      }

      socket.data.userId = session.user.id;
      socket.data.username = session.user.username;
      next();
    } catch (error) {
      console.error('Socket.IO authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('disconnect', () => {
    });

    socket.on('chat:join', async (data: { groupId: number }) => {
      try {
        const { groupId } = data;
        const userId = socket.data.userId;
        const username = socket.data.username;

        const group = await prisma.group.findUnique({
          where: { id: groupId },
          include: { members: true },
        });

        if (!group) {
          socket.emit('error', { message: 'Group not found' });
          return;
        }

        const isMember = group.members.some((m) => m.userId === userId);
        if (!isMember) {
          socket.emit('error', { message: 'Not authorized to join this group' });
          return;
        }

        socket.join(`group_${groupId}`);

        if (!activeUsers.has(groupId)) {
          activeUsers.set(groupId, new Set());
        }
        activeUsers.get(groupId)!.add(userId);

        io!.to(`group_${groupId}`).emit('user:joined', {
          userId,
          username,
          timestamp: new Date().toISOString(),
        });

        const activeUserIds = Array.from(activeUsers.get(groupId) || []);
        const activeUsersList = await prisma.user.findMany({
          where: { id: { in: activeUserIds } },
          select: { id: true, username: true },
        });

        socket.emit('users:active', {
          groupId,
          users: activeUsersList,
        });
      } catch (error) {
        console.error('Error in chat:join:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    socket.on('chat:message', async (data: { groupId: number; content: string }) => {
      try {
        const { groupId, content } = data;
        const userId = socket.data.userId;
        const username = socket.data.username;

        if (!content || content.trim().length === 0) {
          socket.emit('error', { message: 'Message cannot be empty' });
          return;
        }

        if (!socket.rooms.has(`group_${groupId}`)) {
          socket.emit('error', { message: 'Not in this group chat' });
          return;
        }

        try {
          const message = await createMessage(groupId, userId, username, content);

          io!.to(`group_${groupId}`).emit('message:new', {
            id: message._id.toString(),
            groupId,
            userId,
            username,
            content: message.content,
            createdAt: message.createdAt.toISOString(),
          });

          socket.emit('message:ack', {
            messageId: message._id.toString(),
            timestamp: new Date().toISOString(),
          });
        } catch (err: any) {
          console.error('Error creating chat message:', err);
          const msg = err && err.code === 'FORBIDDEN' ? 'Not authorized to post in this group' : 'Failed to send message';
          socket.emit('error', { message: msg });
        }
      } catch (error) {
        console.error('Error in chat:message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('chat:delete', async (data: { groupId: number; messageId: string }) => {
      try {
        const { groupId, messageId } = data;
        const userId = socket.data.userId;

        try {
          await deleteMessage(messageId, userId, groupId);
          io!.to(`group_${groupId}`).emit('message:deleted', {
            messageId,
            timestamp: new Date().toISOString(),
          });
        } catch (err: any) {
          console.error('Error deleting chat message:', err);
          let msg = 'Failed to delete message';
          if (err && err.code === 'NOT_FOUND') msg = 'Message not found';
          else if (err && err.code === 'FORBIDDEN') msg = 'Can only delete your own messages';
          else if (err && err.code === 'INVALID') msg = 'Message not in this group';
          socket.emit('error', { message: msg });
        }
      } catch (error) {
        console.error('Error in chat:delete:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    socket.on('chat:leave', (data: { groupId: number }) => {
      try {
        const { groupId } = data;
        const userId = socket.data.userId;
        const username = socket.data.username;

        socket.leave(`group_${groupId}`);

        activeUsers.get(groupId)?.delete(userId);
        if (activeUsers.get(groupId)?.size === 0) {
          activeUsers.delete(groupId);
        }

        io!.to(`group_${groupId}`).emit('user:left', {
          userId,
          username,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error in chat:leave:', error);
      }
    });

    socket.on('disconnect', () => {
      try {
        activeUsers.forEach((users, groupId) => {
          if (users.has(socket.data.userId)) {
            users.delete(socket.data.userId);
            io!.to(`group_${groupId}`).emit('user:left', {
              userId: socket.data.userId,
              username: socket.data.username,
              timestamp: new Date().toISOString(),
            });
          }
        });
      } catch (error) {
        console.error('Error in disconnect:', error);
      }
    });
  });

}

export function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}
