import { beforeEach, describe, expect, it, vi } from "vitest";

const connect = vi.fn();

vi.mock("mongoose", () => ({
  default: {
    connect,
  },
  connect,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.MONGODB_URI = "mongodb://localhost:27017/splitmates-test";
});

describe("mongodb helper", () => {
  it("connects only once when already connected", async () => {
    connect.mockResolvedValueOnce(undefined);

    const { connectToMongoDB } = await import("@/lib/mongodb");

    await connectToMongoDB();
    await connectToMongoDB();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("rethrows connection errors", async () => {
    connect.mockRejectedValueOnce(new Error("mongo down"));

    const { connectToMongoDB } = await import("@/lib/mongodb");

    await expect(connectToMongoDB()).rejects.toThrow("mongo down");
  });
});