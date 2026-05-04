import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    group: {
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/models/ChatMessage', () => ({
  ChatMessage: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { ChatMessage } from '@/lib/models/ChatMessage';
import { getMessages, createMessage, deleteMessage } from '@/lib/splitmates/services/chat-service';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('chat-service', () => {
  describe('getMessages', () => {
    it('throws when group not found', async () => {
      (prisma.group.findUnique as any).mockResolvedValueOnce(null);
      await expect(getMessages(1, 1, 10, 2)).rejects.toThrow('Group not found');
    });

    it('throws FORBIDDEN when user not member', async () => {
      (prisma.group.findUnique as any).mockResolvedValueOnce({ id: 1, members: [{ userId: 3 }] });
      await expect(getMessages(1, 1, 10, 2)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('returns paginated messages', async () => {
      const fakeMessages = [
        { _id: { toString: () => 'm1' }, groupId: 1, userId: 2, username: 'u', content: 'hi', createdAt: new Date() },
      ];
      (prisma.group.findUnique as any).mockResolvedValueOnce({ id: 1, members: [{ userId: 2 }] });
      (ChatMessage.find as any).mockReturnValueOnce({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => fakeMessages }) }) }) });
      (ChatMessage.countDocuments as any).mockResolvedValueOnce(1);

      const res = await getMessages(1, 1, 10, 2);
      expect(res.messages).toHaveLength(1);
      expect(res.totalMessages).toBe(1);
    });
  });

  describe('createMessage', () => {
    it('throws when group not found', async () => {
      (prisma.group.findUnique as any).mockResolvedValueOnce(null);
      await expect(createMessage(5, 1, 'u', 'hi')).rejects.toThrow('Group not found');
    });

    it('throws FORBIDDEN when user not member', async () => {
      (prisma.group.findUnique as any).mockResolvedValueOnce({ id: 5, members: [{ userId: 2 }] });
      await expect(createMessage(5, 1, 'u', 'hi')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('throws INVALID when content empty', async () => {
      (prisma.group.findUnique as any).mockResolvedValueOnce({ id: 5, members: [{ userId: 1 }] });
      await expect(createMessage(5, 1, 'u', '   ')).rejects.toMatchObject({ code: 'INVALID' });
    });

    it('creates and returns a message', async () => {
      (prisma.group.findUnique as any).mockResolvedValueOnce({ id: 5, members: [{ userId: 1 }] });
      const created = { _id: { toString: () => 'msg-1' }, content: 'hello', createdAt: new Date() };
      (ChatMessage.create as any).mockResolvedValueOnce(created);

      const msg = await createMessage(5, 1, 'u', 'hello');
      expect(ChatMessage.create).toHaveBeenCalled();
      expect(msg).toBe(created);
    });
  });

  describe('deleteMessage', () => {
    it('throws NOT_FOUND when message missing', async () => {
      (ChatMessage.findById as any).mockResolvedValueOnce(null);
      await expect(deleteMessage('x', 1, 5)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws FORBIDDEN when not owner', async () => {
      (ChatMessage.findById as any).mockResolvedValueOnce({ userId: 2, groupId: 5 });
      await expect(deleteMessage('x', 1, 5)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('throws INVALID when wrong group', async () => {
      (ChatMessage.findById as any).mockResolvedValueOnce({ userId: 1, groupId: 6 });
      await expect(deleteMessage('x', 1, 5)).rejects.toMatchObject({ code: 'INVALID' });
    });

    it('deletes when valid', async () => {
      (ChatMessage.findById as any).mockResolvedValueOnce({ userId: 1, groupId: 5 });
      (ChatMessage.findByIdAndDelete as any).mockResolvedValueOnce({});
      await expect(deleteMessage('x', 1, 5)).resolves.toBeTruthy();
      expect(ChatMessage.findByIdAndDelete).toHaveBeenCalledWith('x');
    });
  });
});
