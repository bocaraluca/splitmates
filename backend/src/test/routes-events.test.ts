import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/events/route";

const deps = vi.hoisted(() => ({
  subscribeToEvents: vi.fn(),
  getCurrentUserFromRequest: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("@/lib/splitmates", () => deps);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/events", () => {
  it("establishes stream, handles events, triggers heartbeat, and cancels cleanly", async () => {
    let mockCallback: (payload: any) => void = () => {};
    const unsubscribeMock = vi.fn();

    deps.subscribeToEvents.mockImplementation((callback) => {
      mockCallback = callback;
      return unsubscribeMock;
    });

    const response = await GET();
    
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(response.headers.get("Connection")).toBe("keep-alive");

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const firstRead = await reader.read();
    expect(decoder.decode(firstRead.value)).toContain("retry: 2000");

    mockCallback({ test: "event-payload" });
    const secondRead = await reader.read();
    expect(decoder.decode(secondRead.value)).toContain("event: update");
    expect(decoder.decode(secondRead.value)).toContain('{"test":"event-payload"}');

    const pingReadPromise = reader.read();
    vi.advanceTimersByTime(15000);
    const thirdRead = await pingReadPromise;
    expect(decoder.decode(thirdRead.value)).toContain("event: ping");

    await reader.cancel();
    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it("handles cancel when heartbeat is missing to cover the false branch", async () => {
    const originalSetInterval = globalThis.setInterval;
    (globalThis as any).setInterval = () => null;

    const unsubscribeMock = vi.fn();
    deps.subscribeToEvents.mockReturnValue(unsubscribeMock);

    const response = await GET();
    const reader = response.body!.getReader();
    
    await reader.cancel();
    expect(unsubscribeMock).toHaveBeenCalled();

    globalThis.setInterval = originalSetInterval;
  });
});