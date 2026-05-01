import { render, screen, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackendSyncProvider } from "@/components/providers/backend-sync-provider";

const { syncPendingBackendRequests } = vi.hoisted(() => ({
  syncPendingBackendRequests: vi.fn().mockResolvedValue({ synced: 0, remaining: 0 }),
}));

vi.mock("@/lib/backend-api", () => ({
  backendWebSocketUrl: () => "ws://backend.test/ws",
  syncPendingBackendRequests,
}));

type Listener = (event: Event) => void;

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;

  readonly listeners = new Map<string, Set<Listener>>();
  readonly url: string;
  readyState = MockWebSocket.CONNECTING;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, detail?: unknown) {
    const event = new Event(type) as Event & { data?: unknown };
    event.data = detail;
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close");
  }
}

describe("BackendSyncProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    window.localStorage.clear();
    MockWebSocket.instances = [];
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows an offline banner and stops reconnecting when the browser goes offline", async () => {
    render(
      <BackendSyncProvider>
        <div>App content</div>
      </BackendSyncProvider>,
    );

    expect(MockWebSocket.instances).toHaveLength(1);

    await act(async () => {
      window.dispatchEvent(new Event("offline"));
      await vi.runAllTimersAsync();
    });

    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("shows an offline banner and reconnects when the backend websocket closes", async () => {
    render(
      <BackendSyncProvider>
        <div>App content</div>
      </BackendSyncProvider>,
    );

    const socket = MockWebSocket.instances[0];
    expect(socket).toBeDefined();

    await act(async () => {
      socket?.close();
      await vi.runAllTimersAsync();
    });

    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2);
  });
});
