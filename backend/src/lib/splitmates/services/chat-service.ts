import { prisma } from '../../prisma.ts';
import { ChatMessage } from '../../models/ChatMessage.ts';

export async function getMessages(
  groupId: number,
  page: number,
  pageSize: number,
  viewerUserId: number
) {
  const group = await prisma.group.findUnique({ where: { id: groupId }, include: { members: true } });
  if (!group) {
    throw new Error('Group not found');
  }

  const isMember = group.members.some((m) => m.userId === viewerUserId);
  if (!isMember) {
    const err: any = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }

  const skip = (page - 1) * pageSize;

  const [messages, totalMessages] = await Promise.all([
    ChatMessage.find({ groupId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    ChatMessage.countDocuments({ groupId }),
  ]);

  const orderedMessages = messages
    .reverse()
    .map((message: any) => ({
      id: message._id.toString(),
      groupId: message.groupId,
      userId: message.userId,
      username: message.username,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    }));

  return {
    messages: orderedMessages,
    totalMessages,
    page,
    pageSize,
    totalPages: Math.ceil(totalMessages / pageSize),
  };
}

export async function createMessage(groupId: number, userId: number, username: string, content: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId }, include: { members: true } });
  if (!group) {
    throw new Error('Group not found');
  }

  const isMember = group.members.some((m) => m.userId === userId);
  if (!isMember) {
    const err: any = new Error('Not authorized to post in this group');
    err.code = 'FORBIDDEN';
    throw err;
  }

  const trimmed = content.trim();
  if (!trimmed) {
    const err: any = new Error('Message cannot be empty');
    err.code = 'INVALID';
    throw err;
  }

  const message = await ChatMessage.create({
    groupId,
    userId,
    username,
    content: trimmed,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return message;
}

export async function deleteMessage(messageId: string, userId: number, groupId: number) {
  const message = await ChatMessage.findById(messageId);
  if (!message) {
    const err: any = new Error('Message not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (message.userId !== userId) {
    const err: any = new Error('Can only delete your own messages');
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (message.groupId !== groupId) {
    const err: any = new Error('Message not in this group');
    err.code = 'INVALID';
    throw err;
  }

  await ChatMessage.findByIdAndDelete(messageId);
  return true;
}

export default {
  getMessages,
  createMessage,
  deleteMessage,
};
