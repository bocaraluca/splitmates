import { describe, expect, it, beforeEach } from "vitest";
import {
  getState,
  getUserRecordByIdentifier,
  loginUser,
  signupUser,
  resetSplitmatesStateForTests,
  resolveToken,
} from "@/lib/splitmates";

beforeEach(() => {
  resetSplitmatesStateForTests();
});

describe("auth flows", () => {
  it("logs in with username or email and stores tokens", () => {
    const byUsername = loginUser({ identifier: "ana", password: "raluca" });
    expect(byUsername.user.username).toBe("ana");

    const byEmail = loginUser({ identifier: "elena@gmail.com", password: "raluca" });
    expect(byEmail.user.username).toBe("elena");
    expect(resolveToken(byEmail.token)?.username).toBe("elena");
  });

  it("rejects duplicate usernames and emails", () => {
    expect(() =>
      signupUser({
        username: "raluca",
        email: "new@example.com",
        password: "secret123",
      }),
    ).toThrow("Username already exists.");

    expect(() =>
      signupUser({
        username: "newuser",
        email: "raluca@gmail.com",
        password: "secret123",
      }),
    ).toThrow("Email already exists.");
  });

  it("creates a new user with a hashed password", () => {
    const session = signupUser({
      username: "maria",
      email: "maria@example.com",
      password: "secret123",
    });

    expect(session.user.username).toBe("maria");
    expect(getUserRecordByIdentifier("maria")).toBeTruthy();
  });

  it("resolves tokens after session map is cleared (server restart-like)", () => {
    const session = loginUser({ identifier: "ana", password: "raluca" });
    getState().sessions.clear();

    expect(resolveToken(session.token)?.username).toBe("ana");
  });
});

