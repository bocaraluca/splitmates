import { describe, expect, it } from "vitest";

describe("ChatMessage model", () => {
  it("defines the expected schema and model name", async () => {
    const { ChatMessage } = await import("@/lib/models/ChatMessage");

    expect(ChatMessage.modelName).toBe("ChatMessage");
    expect(ChatMessage.schema.path("groupId")).toBeDefined();
    expect(ChatMessage.schema.path("content")).toBeDefined();
    expect(ChatMessage.schema.indexes().length).toBeGreaterThan(0);
  });
});