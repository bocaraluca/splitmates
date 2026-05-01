import bcrypt from "bcryptjs";
import type { LoginResponse } from "@/lib/splitmates/model";
import { emitEvent } from "@/lib/splitmates/core/events";
import { findUserByIdentifier, getState, toUser } from "@/lib/splitmates/core/state";
import { buildSessionToken } from "./session";
import type { LoginInput } from "./types";

export function loginUser(input: LoginInput): LoginResponse {
  const user = findUserByIdentifier(input.identifier);
  if (!user || !bcrypt.compareSync(input.password, user.passwordHash)) {
    throw new Error("Invalid login credentials.");
  }

  const token = buildSessionToken(user.id);
  getState().sessions.set(token, user.id);
  emitEvent("user.loggedIn", toUser(user));

  return { token, user: toUser(user)! };
}
