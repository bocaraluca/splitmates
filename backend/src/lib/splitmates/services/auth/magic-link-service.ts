import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendMagicLinkEmail } from "./mail-service";

export async function createMagicLink(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  await prisma.magicLinkToken.create({
    data: {
      token,
      email: normalizedEmail,
      userId: existingUser?.id ?? null,
      expiresAt,
    },
  });

  await sendMagicLinkEmail(normalizedEmail, token);

  return { userId: existingUser?.id ?? null };
}

export async function verifyMagicLink(token: string) {
  const magicLinkToken = await prisma.magicLinkToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!magicLinkToken || magicLinkToken.usedAt || magicLinkToken.expiresAt < new Date()) {
    return null;
  }

  let user = magicLinkToken.user;

  if (!user) {
    const username =
      magicLinkToken.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "") +
      "_" +
      crypto.randomBytes(3).toString("hex");

    const role = await prisma.role.findFirst({ where: { title: "user" } });
    if (!role) throw new Error("Default role not found.");

    user = await prisma.user.create({
      data: {
        email: magicLinkToken.email,
        username,
        roleId: role.id,
      },
    });
  }

  await prisma.magicLinkToken.update({
    where: { id: magicLinkToken.id },
    data: { usedAt: new Date() },
  });

  return user;
}