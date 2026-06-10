import { prisma } from "@/lib/prisma";
import type { Id } from "../model/types";

type NotificationType = "group_added" | "expense_added" | "payment_request" | "payment_received" | "payment_failed";

async function create(params: {
  userId: Id;
  type: NotificationType;
  title: string;
  body: string;
  groupId?: Id;
  expenseId?: Id;
  paymentId?: Id;
  fromUserId?: Id;
}) {
  return prisma.notification.create({
    data: {
      userId: Number(params.userId),
      type: params.type,
      title: params.title,
      body: params.body,
      groupId: params.groupId ? Number(params.groupId) : null,
      expenseId: params.expenseId ? Number(params.expenseId) : null,
      paymentId: params.paymentId ? Number(params.paymentId) : null,
      fromUserId: params.fromUserId ? Number(params.fromUserId) : null,
    },
  });
}

export async function notifyGroupAdded(userId: Id, groupId: Id, groupName: string, addedByUsername: string) {
  await create({
    userId,
    type: "group_added",
    title: "Added to a group",
    body: `${addedByUsername} added you to "${groupName}".`,
    groupId,
    fromUserId: undefined,
  });
}

export async function notifyExpenseAdded(participantIds: Id[], payerId: Id, groupId: Id, expenseId: Id, expenseTitle: string, groupName: string, payerUsername: string) {
  await Promise.all(
    participantIds
      .filter((id) => Number(id) !== Number(payerId))
      .map((userId) =>
        create({
          userId,
          type: "expense_added",
          title: "New expense in " + groupName,
          body: `${payerUsername} added "${expenseTitle}" — you owe a share.`,
          groupId,
          expenseId,
          fromUserId: payerId,
        })
      )
  );
}

export async function notifyPaymentReceived(toUserId: Id, fromUserId: Id, groupId: Id, paymentId: Id, amount: number, fromUsername: string, groupName: string) {
  await create({
    userId: toUserId,
    type: "payment_received",
    title: "Payment received",
    body: `${fromUsername} paid you ${amount.toFixed(2)} RON in "${groupName}".`,
    groupId,
    paymentId,
    fromUserId,
  });
}

export async function notifyPaymentFailed(fromUserId: Id, toUserId: Id, groupId: Id, amount: number, toUsername: string, groupName: string) {
  await create({
    userId: fromUserId,
    type: "payment_failed",
    title: "Payment failed",
    body: `Your payment of ${amount.toFixed(2)} RON to ${toUsername} in "${groupName}" failed. Please try again.`,
    groupId,
    fromUserId: toUserId,
  });
}

export async function notifyPaymentRequest(toUserId: Id, fromUserId: Id, groupId: Id, amount: number, fromUsername: string, groupName: string) {
  await create({
    userId: toUserId,
    type: "payment_request",
    title: "Payment request",
    body: `${fromUsername} is requesting ${amount.toFixed(2)} RON from you in "${groupName}".`,
    groupId,
    fromUserId,
  });
}

export async function getNotifications(userId: Id) {
  return prisma.notification.findMany({
    where: { userId: Number(userId) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getUnreadCount(userId: Id) {
  return prisma.notification.count({
    where: { userId: Number(userId), read: false },
  });
}

export async function markAsRead(notificationId: Id, userId: Id) {
  return prisma.notification.updateMany({
    where: { id: Number(notificationId), userId: Number(userId) },
    data: { read: true },
  });
}

export async function markAllAsRead(userId: Id) {
  return prisma.notification.updateMany({
    where: { userId: Number(userId), read: false },
    data: { read: true },
  });
}

export async function notifyChatMessage(
  memberIds: Id[],
  senderId: Id,
  groupId: Id,
  groupName: string,
  senderUsername: string,
  preview: string,
) {
  await Promise.all(
    memberIds
      .filter((id) => Number(id) !== Number(senderId))
      .map((userId) =>
        create({
          userId,
          type: "chat_message",
          title: `New message in ${groupName}`,
          body: `${senderUsername}: ${preview.length > 60 ? preview.slice(0, 60) + "…" : preview}`,
          groupId,
          fromUserId: senderId,
        })
      )
  );
}

export async function deleteNotification(notificationId: Id, userId: Id) {
  return prisma.notification.deleteMany({
    where: { id: Number(notificationId), userId: Number(userId) },
  });
}

export async function deleteAllNotifications(userId: Id) {
  return prisma.notification.deleteMany({
    where: { userId: Number(userId) },
  });
}
