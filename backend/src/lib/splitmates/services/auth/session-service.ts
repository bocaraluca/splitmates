import { randomInt } from "node:crypto";
import type { Id } from "@/lib/splitmates/model";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE_NAME = "splitmates_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function createSessionToken(userId: number) {
  const suffix = `${Date.now()}${randomInt(1000, 9999)}`;
  return `session-${userId}-${suffix}`;
}

function readCookie(cookieHeader: string | null, cookieName: string) {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${cookieName}=`));
  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(cookieName.length + 1));
}

export function readSessionTokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (bearer) {
    return bearer;
  }

  return readCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME);
}

export async function revokeSessionToken(token: string | null | undefined) {
  if (!token) {
    return;
  }

  await prisma.session.updateMany({
    where: { token, revokedAt: null },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function getUserBySessionToken(token: string | null | undefined) {
  if (!token) {
    return null;
  }

  const session = await prisma.session.findFirst({
    where: {
      token,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  return session.user;
}

export async function getCurrentUserFromRequest(request: Request, fallbackUserId?: Id | null) {
  const sessionUser = await getUserBySessionToken(readSessionTokenFromRequest(request));
  if (sessionUser) {
    return sessionUser;
  }

  if (fallbackUserId) {
    return prisma.user.findUnique({
      where: { id: fallbackUserId },
    });
  }

  const url = new URL(request.url);
  const queryUserId = url.searchParams.get("userId");
  if (queryUserId) {
    return prisma.user.findUnique({
      where: { id: Number(queryUserId) },
    });
  }

  return null;
}

export async function createSession(userId: number) {
  const token = createSessionToken(userId);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}