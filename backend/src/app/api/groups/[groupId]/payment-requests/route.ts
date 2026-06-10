import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getCurrentUserFromRequest, getGroupById } from "@/lib/splitmates";
import { prisma } from "@/lib/prisma";
import { notifyPaymentRequest } from "@/lib/splitmates/services/notification-service";
import { z } from "zod";

export const runtime = "nodejs";

const createRequestSchema = z.object({
  toUserId: z.number().int().positive(),
  amount: z.number().positive(),
});

export async function GET(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const actor = await getCurrentUserFromRequest(request);
  if (!actor) return jsonError("Unauthorized.", 401);

  const groupId = Number((await context.params).groupId);
  if (!Number.isInteger(groupId) || groupId <= 0) return jsonError("Invalid group id.", 400);

  const requests = await prisma.paymentRequest.findMany({
    where: {
      groupId,
      OR: [{ fromUserId: actor.id }, { toUserId: actor.id }],
    },
    include: {
      fromUser: { select: { id: true, username: true, email: true } },
      toUser: { select: { id: true, username: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk({ requests });
}

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) return jsonError("Unauthorized.", 401);

    const groupId = Number((await context.params).groupId);
    if (!Number.isInteger(groupId) || groupId <= 0) return jsonError("Invalid group id.", 400);

    const group = await getGroupById(groupId);
    if (!group) return jsonError("Group not found.", 404);

    const body = await request.json();
    const { toUserId, amount } = createRequestSchema.parse(body);

    if (toUserId === actor.id) return jsonError("You cannot request payment from yourself.", 400);
    if (!group.memberIds.includes(toUserId)) return jsonError("User is not in this group.", 400);

    const paymentRequest = await prisma.paymentRequest.create({
      data: { groupId, fromUserId: actor.id, toUserId, amount },
    });

    const fromUser = await prisma.user.findUnique({ where: { id: actor.id } });
    if (fromUser) {
      void notifyPaymentRequest(toUserId, actor.id, groupId, amount, fromUser.username, group.name);
    }

    return jsonOk({ paymentRequest }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create payment request.";
    return jsonError(message, 400);
  }
}
