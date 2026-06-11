import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "../core/events";
import { roundMoney } from "../core/math";
import type { Id } from "../model/types";
import { notifyPaymentReceived, notifyPaymentFailed } from "./notification-service";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");


export async function createStripeAccount(userId: Id): Promise<string> {
  const account = await stripe.accounts.create({
    type: "custom",
    country: "US",
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeAccountId: account.id },
  });

  return account.id;
}

export async function unlinkStripeAccount(userId: Id): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeAccountId: true } });
  if (user?.stripeAccountId) {
    await stripe.accounts.del(user.stripeAccountId);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { stripeAccountId: null },
  });
}

export async function createStripePayment(groupId: Id, actorUserId: Id, fromUserId: Id, toUserId: Id, amount: number) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) throw new Error("Group not found.");
  if (!group.members.find((m) => m.userId === fromUserId)) throw new Error("Sender is not in this group.");
  if (!group.members.find((m) => m.userId === toUserId)) throw new Error("Recipient is not in this group.");

  const [fromUser, toUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: fromUserId } }),
    prisma.user.findUnique({ where: { id: toUserId } }),
  ]);

  if (!fromUser?.stripeAccountId) throw new Error("Sender has no Stripe account linked. Go to profile settings to connect your Stripe account.");
  if (!toUser?.stripeAccountId) throw new Error("Recipient has no Stripe account linked.");

  const payment = await prisma.payment.create({
    data: {
      groupId,
      fromUserId,
      toUserId,
      amount: roundMoney(amount),
      status: "pending",
      method: "stripe",
    },
  });

  try {
    const RON_TO_USD = 0.22;
    const usdAmount = Math.round(roundMoney(amount) * RON_TO_USD * 100);

    await stripe.charges.create({
      amount: usdAmount,
      currency: "usd",
      source: "tok_bypassPending",
      description: "Splitmates available balance funding",
    });

    const transfer = await stripe.transfers.create({
      amount: usdAmount,
      currency: "usd",
      destination: toUser.stripeAccountId,
    });

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "completed",
        stripeTransferId: transfer.id ?? null,
      },
    });

    emitEvent("payment.created", updated);
    void notifyPaymentReceived(toUserId, fromUserId, groupId, payment.id, roundMoney(amount), fromUser.username, group.name);
    return updated;
  } catch (err) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "failed" },
    });
    void notifyPaymentFailed(fromUserId, toUserId, groupId, roundMoney(amount), toUser.username, group.name);
    throw err;
  }
}
