import type { Id } from "@/lib/splitmates/model";
import { findUserById, getState, nextSessionToken } from "@/lib/splitmates/core/state";

export const SESSION_COOKIE_NAME = "splitmates_session";

export function buildSessionToken(userId: number) {
  const sequence = nextSessionToken().replace("session-", "");
  return `session-${userId}-${sequence}`;
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

export function resolveSessionToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (bearer) {
    return bearer;
  }

  return readCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME);
}

export function clearSessionToken(token: string | null | undefined) {
  if (!token) {
    return;
  }

  const state = getState();
  state.sessions.delete(token);
  state.revokedSessionTokens.add(token);
}

export function resolveToken(token: string | null | undefined) {
  if (!token) {
    return null;
  }

  if (getState().revokedSessionTokens.has(token)) {
    return null;
  }

  const userId = getState().sessions.get(token);
  if (userId) {
    return findUserById(userId);
  }

  const match = /^session-(\d+)-\d+$/.exec(token);
  if (!match) {
    return null;
  }

  return findUserById(Number(match[1]));
}

export function resolveCurrentUser(request: Request, fallbackUserId?: Id | null) {
  const sessionUser = resolveToken(resolveSessionToken(request));
  if (sessionUser) {
    return sessionUser;
  }

  if (fallbackUserId) {
    return findUserById(fallbackUserId);
  }

  const url = new URL(request.url);
  const queryUserId = url.searchParams.get("userId");
  if (queryUserId) {
    return findUserById(Number(queryUserId));
  }

  return null;
}
