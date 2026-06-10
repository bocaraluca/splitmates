import { prisma } from "@/lib/prisma";
import { emitEvent } from "../core/events";
import { roundMoney } from "../core/math";
import type { Id } from "../model/types";
import { notifyPaymentReceived, notifyPaymentFailed } from "./notification-service";

const WISE_API_URL = process.env.WISE_API_URL ?? "https://api.sandbox.transferwise.tech";
const WISE_API_TOKEN = process.env.WISE_API_TOKEN ?? "";

async function wiseRequest(method: string, path: string, body?: object) {
  const res = await fetch(`${WISE_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${WISE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Wise API error ${res.status} at ${method} ${path}: ${error}`);
  }

  return res.json();
}

async function getProfileId(): Promise<number> {
  const profiles = await wiseRequest("GET", "/v2/profiles");
  console.log("[Wise] profiles response:", JSON.stringify(profiles));
  const list = Array.isArray(profiles) ? profiles : (profiles?.content ?? []);
  const profile = list.find((p: any) => p.type?.toUpperCase() === "BUSINESS") ?? list.find((p: any) => p.type?.toUpperCase() === "PERSONAL");
  if (!profile) throw new Error(`No Wise profile found. Raw response: ${JSON.stringify(profiles)}`);
  return profile.id;
}

async function createRecipient(profileId: number, email: string): Promise<number> {
  const recipient = await wiseRequest("POST", "/v1/accounts", {
    profile: profileId,
    accountHolderName: email,
    currency: "RON",
    type: "email",
    details: { email },
  });
  return recipient.id;
}

async function createQuote(profileId: number, amount: number): Promise<string> {
  const quote = await wiseRequest("POST", "/v3/profiles/" + profileId + "/quotes", {
    sourceCurrency: "RON",
    targetCurrency: "RON",
    sourceAmount: amount,
    targetAmount: null,
    payOut: "BALANCE",
  });
  return quote.id;
}

async function createTransfer(recipientId: number, quoteId: string): Promise<number> {
  const transfer = await wiseRequest("POST", "/v1/transfers", {
    targetAccount: recipientId,
    quoteUuid: quoteId,
    customerTransactionId: crypto.randomUUID(),
  });
  return transfer.id;
}

async function fundTransfer(profileId: number, transferId: number): Promise<void> {
  const isSandbox = WISE_API_URL.includes("sandbox");

  if (isSandbox) {
    return;
  }

  await wiseRequest("POST", `/v3/profiles/${profileId}/transfers/${transferId}/payments`, {
    type: "BALANCE",
  });
}

export async function createWisePayment(groupId: Id, actorUserId: Id, fromUserId: Id, toUserId: Id, amount: number) {
  // Verify both users are in the group
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) throw new Error("Group not found.");
  if (!group.members.find((m) => m.userId === fromUserId)) throw new Error("Sender is not in this group.");
  if (!group.members.find((m) => m.userId === toUserId)) throw new Error("Recipient is not in this group.");

  // Verify both users have Wise email set
  const [fromUser, toUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: fromUserId } }),
    prisma.user.findUnique({ where: { id: toUserId } }),
  ]);

  if (!fromUser?.wiseEmail) throw new Error("Sender has no Wise account linked. Go to profile settings to add your Wise email.");
  if (!toUser?.wiseEmail) throw new Error("Recipient has no Wise account linked.");

  // Create payment record as pending first
  const payment = await prisma.payment.create({
    data: {
      groupId,
      fromUserId,
      toUserId,
      amount: roundMoney(amount),
      status: "pending",
      method: "wise",
    },
  });

  try {
    const profileId = await getProfileId();
    const recipientId = await createRecipient(profileId, toUser.wiseEmail);
    const quoteId = await createQuote(profileId, roundMoney(amount));
    const transferId = await createTransfer(recipientId, quoteId);
    await fundTransfer(profileId, transferId);

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "completed",
        wiseTransferId: String(transferId),
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

export async function linkWiseEmail(userId: Id, wiseEmail: string) {
  return await prisma.user.update({
    where: { id: userId },
    data: { wiseEmail },
  });
}

export async function unlinkWiseEmail(userId: Id) {
  return await prisma.user.update({
    where: { id: userId },
    data: { wiseEmail: null },
  });
}
