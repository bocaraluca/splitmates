import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete (globalThis as typeof globalThis & { __splitmatesSocketIO?: unknown }).__splitmatesSocketIO;
});

describe("chat routes", () => {
  it("GET covers auth, membership, pagination, success, and error paths", async () => {
    const getCurrentUserFromRequest = vi.fn();
    const prisma = {
      group: {
        findUnique: vi.fn(),
      },
    } as any;
    const chatFind = vi.fn();
    const chatCount = vi.fn();

    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/models/ChatMessage", () => ({
      ChatMessage: {
        find: chatFind,
        countDocuments: chatCount,
      },
    }));
    vi.doMock("@/lib/splitmates/services/auth/session-service", () => ({ getCurrentUserFromRequest }));

    const mod = await import("@/app/api/groups/[groupId]/chat/route");

    const invalidId = await mod.GET(new Request("http://localhost/api/groups/x/chat"), { params: Promise.resolve({ groupId: "x" }) });
    expect(invalidId.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const noAuth = await mod.GET(new Request("http://localhost/api/groups/1/chat?page=1&pageSize=50"), { params: Promise.resolve({ groupId: "1" }) });
    expect(noAuth.status).toBe(401);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    prisma.group.findUnique.mockResolvedValueOnce(null);
    const missingGroup = await mod.GET(new Request("http://localhost/api/groups/1/chat?page=1&pageSize=50"), { params: Promise.resolve({ groupId: "1" }) });
    expect(missingGroup.status).toBe(404);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 2 });
    prisma.group.findUnique.mockResolvedValueOnce({ id: 1, members: [{ userId: 1 }] });
    const forbidden = await mod.GET(new Request("http://localhost/api/groups/1/chat?page=1&pageSize=50"), { params: Promise.resolve({ groupId: "1" }) });
    expect(forbidden.status).toBe(403);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    prisma.group.findUnique.mockResolvedValueOnce({ id: 1, members: [{ userId: 1 }] });
    const invalidPagination = await mod.GET(new Request("http://localhost/api/groups/1/chat?page=1&pageSize=101"), { params: Promise.resolve({ groupId: "1" }) });
    expect(invalidPagination.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    prisma.group.findUnique.mockResolvedValueOnce({ id: 1, members: [{ userId: 1 }] });
    const invalidPage = await mod.GET(new Request("http://localhost/api/groups/1/chat?page=abc&pageSize=50"), { params: Promise.resolve({ groupId: "1" }) });
    expect(invalidPage.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    prisma.group.findUnique.mockResolvedValueOnce({ id: 1, members: [{ userId: 1 }] });
    const chain = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValueOnce([
        {
          _id: { toString: () => "b" },
          groupId: 1,
          userId: 1,
          username: "raluca",
          content: "Second",
          createdAt: new Date("2026-05-02T10:00:00.000Z"),
        },
        {
          _id: { toString: () => "a" },
          groupId: 1,
          userId: 2,
          username: "ana",
          content: "First",
          createdAt: new Date("2026-05-02T09:00:00.000Z"),
        },
      ]),
    };
    chatFind.mockReturnValueOnce(chain);
    chatCount.mockResolvedValueOnce(2);

    const ok = await mod.GET(new Request("http://localhost/api/groups/1/chat?page=2&pageSize=2"), { params: Promise.resolve({ groupId: "1" }) });
    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toMatchObject({
      totalMessages: 2,
      messages: [
        { id: "a", content: "First" },
        { id: "b", content: "Second" },
      ],
    });

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    prisma.group.findUnique.mockResolvedValueOnce({ id: 1, members: [{ userId: 1 }] });
    const defaultChain = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValueOnce([]),
    };
    chatFind.mockReturnValueOnce(defaultChain);
    chatCount.mockResolvedValueOnce(0);

    const okWithDefaults = await mod.GET(new Request("http://localhost/api/groups/1/chat"), { params: Promise.resolve({ groupId: "1" }) });
    expect(okWithDefaults.status).toBe(200);
    expect(defaultChain.skip).toHaveBeenCalledWith(0);
    expect(defaultChain.limit).toHaveBeenCalledWith(50);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    prisma.group.findUnique.mockResolvedValueOnce({ id: 1, members: [{ userId: 1 }] });
    chatFind.mockImplementationOnce(() => {
      throw new Error("db down");
    });
    const err = await mod.GET(new Request("http://localhost/api/groups/1/chat?page=1&pageSize=50"), { params: Promise.resolve({ groupId: "1" }) });
    expect(err.status).toBe(500);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    prisma.group.findUnique.mockResolvedValueOnce({ id: 1, members: [{ userId: 1 }] });
    chatFind.mockImplementationOnce(() => {
      throw "db down";
    });
    const nonError = await mod.GET(new Request("http://localhost/api/groups/1/chat?page=1&pageSize=50"), { params: Promise.resolve({ groupId: "1" }) });
    expect(nonError.status).toBe(500);
  });

  it("DELETE covers validation, ownership checks, broadcast, and errors", async () => {
    const getCurrentUserFromRequest = vi.fn();
    const prisma = {
      group: {
        findUnique: vi.fn(),
      },
    } as any;
    const ChatMessage = {
      findById: vi.fn(),
      findByIdAndDelete: vi.fn(),
    } as any;

    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/models/ChatMessage", () => ({ ChatMessage }));
    vi.doMock("@/lib/splitmates/services/auth/session-service", () => ({ getCurrentUserFromRequest }));

    const mod = await import("@/app/api/groups/[groupId]/chat/[messageId]/route");

    const invalidId = await mod.DELETE(new Request("http://localhost/api/groups/x/chat/a", { method: "DELETE" }), { params: Promise.resolve({ groupId: "x", messageId: "a" }) });
    expect(invalidId.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const noAuth = await mod.DELETE(new Request("http://localhost/api/groups/1/chat/a", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1", messageId: "a" }) });
    expect(noAuth.status).toBe(401);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    prisma.group.findUnique.mockResolvedValueOnce(null);
    const missingGroup = await mod.DELETE(new Request("http://localhost/api/groups/1/chat/a", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1", messageId: "a" }) });
    expect(missingGroup.status).toBe(404);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    prisma.group.findUnique.mockResolvedValueOnce({ id: 1, members: [{ userId: 2 }] });
    const forbidden = await mod.DELETE(new Request("http://localhost/api/groups/1/chat/a", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1", messageId: "a" }) });
    expect(forbidden.status).toBe(403);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    prisma.group.findUnique.mockResolvedValueOnce({ id: 1, members: [{ userId: 1 }] });
    ChatMessage.findById.mockResolvedValueOnce(null);
    const missingMessage = await mod.DELETE(new Request("http://localhost/api/groups/1/chat/a", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1", messageId: "a" }) });
    expect(missingMessage.status).toBe(404);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    prisma.group.findUnique.mockResolvedValueOnce({ id: 1, members: [{ userId: 1 }] });
    ChatMessage.findById.mockResolvedValueOnce({ id: "a", groupId: 2, userId: 1 });
    const wrongGroup = await mod.DELETE(new Request("http://localhost/api/groups/1/chat/a", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1", messageId: "a" }) });
    expect(wrongGroup.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    prisma.group.findUnique.mockResolvedValueOnce({ id: 1, members: [{ userId: 1 }] });
    ChatMessage.findById.mockResolvedValueOnce({ id: "a", groupId: 1, userId: 2 });
    const wrongUser = await mod.DELETE(new Request("http://localhost/api/groups/1/chat/a", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1", messageId: "a" }) });
    expect(wrongUser.status).toBe(403);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    prisma.group.findUnique.mockResolvedValueOnce({ id: 1, members: [{ userId: 1 }] });
    ChatMessage.findById.mockResolvedValueOnce({ id: "a", groupId: 1, userId: 1 });
    ChatMessage.findByIdAndDelete.mockResolvedValueOnce({ id: "a" });
    const noSocketOk = await mod.DELETE(new Request("http://localhost/api/groups/1/chat/a", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1", messageId: "a" }) });
    expect(noSocketOk.status).toBe(200);

    const emit = vi.fn();
    (globalThis as typeof globalThis & { __splitmatesSocketIO?: { to: (room: string) => { emit: typeof emit } } }).__splitmatesSocketIO = {
      to: () => ({ emit }),
    };
    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    prisma.group.findUnique.mockResolvedValueOnce({ id: 1, members: [{ userId: 1 }] });
    ChatMessage.findById.mockResolvedValueOnce({ id: "b", groupId: 1, userId: 1 });
    ChatMessage.findByIdAndDelete.mockResolvedValueOnce({ id: "b" });
    const ok = await mod.DELETE(new Request("http://localhost/api/groups/1/chat/b", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1", messageId: "b" }) });
    expect(ok.status).toBe(200);
    expect(emit).toHaveBeenCalledWith("message:deleted", expect.objectContaining({ messageId: "b" }));

    delete (globalThis as typeof globalThis & { __splitmatesSocketIO?: unknown }).__splitmatesSocketIO;
    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    prisma.group.findUnique.mockResolvedValueOnce({ id: 1, members: [{ userId: 1 }] });
    ChatMessage.findById.mockRejectedValueOnce(new Error("boom"));
    const err = await mod.DELETE(new Request("http://localhost/api/groups/1/chat/c", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1", messageId: "c" }) });
    expect(err.status).toBe(500);
  });
});