import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { signupUser } from "@/lib/splitmates/services/auth/signup-service";
import { loginUser } from "@/lib/splitmates/services/auth/login-service";
import { getUserBySessionToken } from "@/lib/splitmates/services/auth/session-service";
import { resetDatabase } from "./db-helpers";

beforeEach(async () => {
  await resetDatabase();
});

describe("auth flows", () => {
  it("signup creates a user in the database", async () => {
    const session = await signupUser({
      username: "costica",
      email: "costica@gmail.com",
      password: "secret123",
    });

    expect(session.token).toMatch(/^session-\d+-/);
    expect(session.user.username).toBe("costica");

    const userInDb = await prisma.user.findUnique({ where: { id: session.user.id } });
    expect(userInDb).not.toBeNull();
    expect(userInDb!.email).toBe("costica@gmail.com");
    expect(userInDb!.passwordHash).not.toBe("secret123");
  });

  it("signup rejects duplicate username", async () => {
    await signupUser({ username: "ionel", email: "ionel@gmail.com", password: "secret123" });
    await expect(
      signupUser({ username: "ionel", email: "ionel2@gmail.com", password: "secret123" }),
    ).rejects.toThrow("Username already exists.");
  });

  it("signup rejects duplicate email", async () => {
    await signupUser({ username: "user_one", email: "shared@gmail.com", password: "secret123" });
    await expect(
      signupUser({ username: "user_two", email: "shared@gmail.com", password: "secret123" }),
    ).rejects.toThrow("Email already exists.");
  });

  it("login returns a valid session token", async () => {
    await signupUser({ username: "vasile", email: "vasile@gmail.com", password: "secret123" });

    const session = await loginUser({ identifier: "vasile", password: "secret123" });
    expect(session.token).toBeTruthy();

    const sessionUser = await getUserBySessionToken(session.token);
    expect(sessionUser).not.toBeNull();
    expect(sessionUser!.username).toBe("vasile");
  });

  it("login rejects wrong password", async () => {
    await signupUser({ username: "viorica", email: "viorica@gmail.com", password: "secret123" });
    await expect(
      loginUser({ identifier: "viorica", password: "wrong" }),
    ).rejects.toThrow("Invalid login credentials.");
  });
});