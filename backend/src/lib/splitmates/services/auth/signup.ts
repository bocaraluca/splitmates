import bcrypt from "bcryptjs";
import type { LoginResponse } from "@/lib/splitmates/model";
import { emitEvent } from "@/lib/splitmates/core/events";
import { getState, nextId, toUser } from "@/lib/splitmates/core/state";
import { buildSessionToken } from "./session";
import type { SignupInput } from "./types";

export function signupUser(input: SignupInput): LoginResponse {
  const state = getState();
  const existingUsername = state.users.some((user) => user.username.toLowerCase() === input.username.toLowerCase());
  if (existingUsername) {
    throw new Error("Username already exists.");
  }

  const existingEmail = state.users.some((user) => user.email.toLowerCase() === input.email.toLowerCase());
  if (existingEmail) {
    throw new Error("Email already exists.");
  }

  const user = {
    id: nextId("user"),
    username: input.username,
    email: input.email,
    passwordHash: bcrypt.hashSync(input.password, 10),
    createdAt: new Date().toISOString(),
  };

  state.users.push(user);
  const token = buildSessionToken(user.id);
  state.sessions.set(token, user.id);
  emitEvent("user.signedUp", toUser(user));

  return { token, user: toUser(user)! };
}
