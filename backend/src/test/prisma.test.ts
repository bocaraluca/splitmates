import { describe, it, expect, beforeEach, vi } from "vitest";

describe("prisma client setup", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("throws an error if DATABASE_URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");

    await expect(import("@/lib/prisma")).rejects.toThrow("DATABASE_URL is not set.");

    vi.unstubAllEnvs();
  });
});