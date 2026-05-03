import { beforeEach, describe, expect, it, vi } from "vitest";

const connectToMongoDB = vi.fn();
const prisma = {
  session: {
    findUnique: vi.fn(),
  },
  group: {
    findUnique: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
} as any;

const ChatMessage = {
  create: vi.fn(),
  findById: vi.fn(),
  findByIdAndDelete: vi.fn(),
} as any;

const socketInstances: MockSocketIOServer[] = [];

class MockSocketIOServer {
  options: unknown;
  middleware: ((socket: any, next: (err?: Error) => void) => void) | null = null;
  connectionHandler: ((socket: any) => void) | null = null;
  emittedToRooms: Array<{ room: string; event: string; payload: unknown }> = [];

  constructor(_server: unknown, options: unknown) {
    this.options = options;
    socketInstances.push(this);
  }

  use(handler: (socket: any, next: (err?: Error) => void) => void) {
    this.middleware = handler;
  }

  on(event: string, handler: (socket: any) => void) {
    if (event === "connection") {
      this.connectionHandler = handler;
    }
  }

  to(room: string) {
    return {
      emit: (event: string, payload: unknown) => {
        this.emittedToRooms.push({ room, event, payload });
      },
    };
  }
}

function createSocket(token?: string) {
  const handlers: Record<string, (...args: any[]) => void> = {};
  const rooms = new Set<string>();
  return {
    id: "socket-1",
    data: {} as { userId?: number; username?: string },
    handshake: { auth: token ? { token } : {} },
    rooms,
    handlers,
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      handlers[event] = handler;
    }),
    emit: vi.fn(),
    join: vi.fn((room: string) => rooms.add(room)),
    leave: vi.fn((room: string) => rooms.delete(room)),
    disconnect: vi.fn(),
  };
}

vi.mock("socket.io", () => ({
  Server: MockSocketIOServer,
}));

vi.mock("../lib/mongodb.ts", () => ({ connectToMongoDB }));
vi.mock("../lib/prisma.ts", () => ({ prisma }));
vi.mock("../lib/models/ChatMessage.ts", () => ({ ChatMessage }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  socketInstances.length = 0;
  delete (globalThis as typeof globalThis & { __splitmatesSocketIO?: unknown }).__splitmatesSocketIO;
});

describe("socket-manager", () => {
  it("throws when getIO is called before initialization and fails if MongoDB setup fails", async () => {
    connectToMongoDB.mockRejectedValueOnce(new Error("mongo down"));

    const { initializeSocket, getIO } = await import("@/lib/socket-manager");

    expect(() => getIO()).toThrow("Socket.IO not initialized");
    await expect(initializeSocket({} as any)).rejects.toThrow("mongo down");
  });

  it("initializes auth and chat handlers and broadcasts realtime events", async () => {
    connectToMongoDB.mockResolvedValueOnce(undefined);
    prisma.session.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ user: { id: 1, username: "raluca" }, expiresAt: new Date("2026-05-01T00:00:00.000Z") })
      .mockResolvedValueOnce({ user: { id: 1, username: "raluca" }, expiresAt: new Date("2026-05-05T00:00:00.000Z") })
      .mockResolvedValueOnce({ user: { id: 1, username: "raluca" }, expiresAt: new Date("2026-05-05T00:00:00.000Z") });
    prisma.group.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 5, members: [{ userId: 2 }] })
      .mockResolvedValue({ id: 5, members: [{ userId: 1 }] });
    prisma.user.findMany.mockResolvedValue([{ id: 1, username: "raluca" }]);
    ChatMessage.create.mockResolvedValue({ _id: { toString: () => "msg-1" }, content: "Hello", createdAt: new Date("2026-05-04T00:00:00.000Z") });
    ChatMessage.findById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "msg-1", groupId: 5, userId: 2 })
      .mockResolvedValueOnce({ _id: "msg-1", groupId: 2, userId: 1 })
      .mockResolvedValueOnce({ _id: "msg-1", groupId: 5, userId: 1 })
      .mockResolvedValueOnce({ _id: "msg-1", groupId: 5, userId: 1 });
    ChatMessage.findByIdAndDelete.mockResolvedValue({});

    const { initializeSocket, getIO } = await import("@/lib/socket-manager");
    await initializeSocket({} as any);
    expect(getIO()).toBeDefined();

    const io = socketInstances[0];
    expect(io).toBeDefined();
    expect(io.options).toEqual(expect.objectContaining({ cors: expect.any(Object) }));

    const missingTokenSocket = createSocket();
    const missingTokenNext = vi.fn();
    await io.middleware!(missingTokenSocket, missingTokenNext);
    expect(missingTokenNext).toHaveBeenCalledWith(expect.any(Error));

    const invalidSessionSocket = createSocket("bad");
    const invalidSessionNext = vi.fn();
    await io.middleware!(invalidSessionSocket, invalidSessionNext);
    expect(invalidSessionNext).toHaveBeenCalledWith(expect.any(Error));

    prisma.session.findUnique.mockResolvedValueOnce({ user: { id: 1, username: "raluca" }, expiresAt: new Date("2026-05-01T00:00:00.000Z") });
    const expiredSocket = createSocket("expired");
    const expiredNext = vi.fn();
    await io.middleware!(expiredSocket, expiredNext);
    expect(expiredNext).toHaveBeenCalledWith(expect.any(Error));

    const validSocket = createSocket("valid");
    await io.middleware!(validSocket, vi.fn());
    expect(validSocket.data).toEqual({ userId: 1, username: "raluca" });

    io.connectionHandler!(validSocket);

    await validSocket.handlers["chat:join"]({ groupId: 5 });
    expect(validSocket.emit).toHaveBeenCalledWith("error", expect.objectContaining({ message: "Group not found" }));

    await validSocket.handlers["chat:join"]({ groupId: 5 });
    expect(validSocket.emit).toHaveBeenCalledWith("error", expect.objectContaining({ message: "Not authorized to join this group" }));

    await validSocket.handlers["chat:join"]({ groupId: 5 });
    expect(validSocket.join).toHaveBeenCalledWith("group_5");
    expect(validSocket.emit).toHaveBeenCalledWith("users:active", expect.objectContaining({ groupId: 5 }));

    await validSocket.handlers["chat:message"]({ groupId: 5, content: "   " });
    expect(validSocket.emit).toHaveBeenCalledWith("error", expect.objectContaining({ message: "Message cannot be empty" }));

    await validSocket.handlers["chat:message"]({ groupId: 99, content: "Hello" });
    expect(validSocket.emit).toHaveBeenCalledWith("error", expect.objectContaining({ message: "Not in this group chat" }));

    ChatMessage.create.mockResolvedValueOnce({
      _id: { toString: () => "msg-1" },
      content: "Hello",
      createdAt: new Date("2026-05-04T00:00:00.000Z"),
    });
    await validSocket.handlers["chat:message"]({ groupId: 5, content: "Hello" });
    expect(validSocket.emit).toHaveBeenCalledWith("message:ack", expect.objectContaining({ messageId: "msg-1" }));
    expect(io.emittedToRooms).toEqual(expect.arrayContaining([
      expect.objectContaining({ room: "group_5", event: "message:new" }),
    ]));

    await validSocket.handlers["chat:delete"]({ groupId: 5, messageId: "missing" });
    expect(validSocket.emit).toHaveBeenCalledWith("error", expect.objectContaining({ message: "Message not found" }));

    await validSocket.handlers["chat:delete"]({ groupId: 5, messageId: "msg-1" });
    expect(validSocket.emit).toHaveBeenCalledWith("error", expect.objectContaining({ message: "Can only delete your own messages" }));

    await validSocket.handlers["chat:delete"]({ groupId: 99, messageId: "msg-1" });
    expect(validSocket.emit).toHaveBeenCalledWith("error", expect.objectContaining({ message: "Message not in this group" }));

    await validSocket.handlers["chat:delete"]({ groupId: 5, messageId: "msg-1" });
    expect(io.emittedToRooms).toEqual(expect.arrayContaining([
      expect.objectContaining({ room: "group_5", event: "message:deleted" }),
    ]));

    prisma.group.findUnique.mockRejectedValueOnce(new Error("join fail"));
    await validSocket.handlers["chat:join"]({ groupId: 6 });
    expect(validSocket.emit).toHaveBeenCalledWith("error", expect.objectContaining({ message: "Failed to join chat" }));

    ChatMessage.create.mockRejectedValueOnce(new Error("message fail"));
    await validSocket.handlers["chat:message"]({ groupId: 5, content: "boom" });
    expect(validSocket.emit).toHaveBeenCalledWith("error", expect.objectContaining({ message: "Failed to send message" }));

    ChatMessage.findById.mockReset();
    ChatMessage.findById.mockRejectedValueOnce(new Error("delete fail"));
    await validSocket.handlers["chat:delete"]({ groupId: 5, messageId: "msg-2" });
    expect(validSocket.emit).toHaveBeenCalledWith("error", expect.objectContaining({ message: "Failed to delete message" }));

    const leaveThrowSocket = createSocket("valid-leave");
    await io.middleware!(leaveThrowSocket, vi.fn());
    io.connectionHandler!(leaveThrowSocket);
    leaveThrowSocket.leave.mockImplementationOnce(() => {
      throw new Error("leave fail");
    });
    leaveThrowSocket.handlers["chat:leave"]({ groupId: 5 });

    const disconnectThrowSocket = createSocket("valid-throw");
    await io.middleware!(disconnectThrowSocket, vi.fn());
    io.connectionHandler!(disconnectThrowSocket);
    await disconnectThrowSocket.handlers["chat:join"]({ groupId: 5 });
    const originalTo = io.to.bind(io);
    io.to = ((room: string) => {
      if (room === "group_5") {
        throw new Error("disconnect fail");
      }
      return originalTo(room);
    }) as typeof io.to;
    disconnectThrowSocket.handlers["disconnect"]();
    io.to = originalTo;

    await validSocket.handlers["chat:leave"]({ groupId: 5 });
    expect(validSocket.leave).toHaveBeenCalledWith("group_5");

    const disconnectSocket = createSocket("valid-2");
    await io.middleware!(disconnectSocket, vi.fn());
    io.connectionHandler!(disconnectSocket);
    await disconnectSocket.handlers["chat:join"]({ groupId: 5 });
    disconnectSocket.handlers["disconnect"]();
    expect(io.emittedToRooms).toEqual(expect.arrayContaining([
      expect.objectContaining({ room: "group_5", event: "user:left" }),
    ]));
  });
});