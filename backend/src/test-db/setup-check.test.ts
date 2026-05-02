import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase, createTestUser } from "./db-helpers";

beforeEach(async () => {
  await resetDatabase();
});

describe("test database setup", () => {
  it("connects to splitmates_test and creates the user testuser", async () => {
    const user = await createTestUser("testuser", "test@example.com");
    expect(user.id).toBeGreaterThan(0);
    expect(user.username).toBe("testuser");

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found).not.toBeNull();
    expect(found!.email).toBe("test@example.com");
  });

  it("resetDatabase clears the user table between tests", async () => {
    const count = await prisma.user.count();
    expect(count).toBe(0);
  });
});
