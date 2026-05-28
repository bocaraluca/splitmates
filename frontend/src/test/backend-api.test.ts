import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BackendError,
  addExpenseToOfflineCache,
  fetchFromBackend,
  backendWebSocketUrl,
  markExpenseDeleted,
  removeExpenseFromOfflineCache,
  syncPendingBackendRequests,
  updateExpenseInOfflineCache,
} from "@/lib/backend-api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function readQueue() {
  const raw = window.localStorage.getItem("splitmates.offline.queue");
  return raw ? (JSON.parse(raw) as Array<unknown>) : [];
}

describe("backend-api offline sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("queues offline POST requests and returns optimistic response", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("fetch failed"));

    const result = await fetchFromBackend<{ expense: { id: number; title: string } }>("/groups/1/expenses", {
      method: "POST",
      token: "token-a",
      body: JSON.stringify({ title: "Offline expense" }),
    });

    expect(result.expense.title).toBe("Offline expense");
    expect(result.expense.id).toBeLessThan(0);

    const queue = readQueue();
    expect(queue).toHaveLength(1);
  });

  it("rejects offline group creation instead of queueing it", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(fetchFromBackend<{ group: { id: number; name: string } }>("/groups", {
      method: "POST",
      body: JSON.stringify({ name: "Offline group", category: "friends" }),
    })).rejects.toMatchObject({
      message: "You are offline. Group changes require the backend.",
      status: 503,
    });

    expect(window.localStorage.getItem("splitmates.offline.cache")).toBeNull();
  });

  it("builds websocket URL from env when provided", () => {
    const previous = process.env.NEXT_PUBLIC_BACKEND_WS_URL;
    process.env.NEXT_PUBLIC_BACKEND_WS_URL = "wss://127.0.0.1:4500";

    const url = backendWebSocketUrl("/ws");
    expect(url).toBe("wss://127.0.0.1:4500/ws");

    process.env.NEXT_PUBLIC_BACKEND_WS_URL = previous;
  });

  it("builds websocket URL from default base when env is missing", () => {
    const previous = process.env.NEXT_PUBLIC_BACKEND_WS_URL;
    delete process.env.NEXT_PUBLIC_BACKEND_WS_URL;

    const url = backendWebSocketUrl("/ws");
    expect(url).toBe("ws://localhost:4000/ws");

    process.env.NEXT_PUBLIC_BACKEND_WS_URL = previous;
  });

  it("throws backend error for auth mutation while offline", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(
      fetchFromBackend("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier: "raluca", password: "raluca" }),
      }),
    ).rejects.toMatchObject({
      message: "You are offline. Authentication requires the backend.",
      status: 503,
    });
  });

  it("uses cached GET data when backend is unreachable", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ groups: [{ id: 1, name: "Trip" }] }))
      .mockResolvedValueOnce(jsonResponse({ error: "Backend server is unreachable.", code: "BACKEND_UNREACHABLE" }, 503));

    const first = await fetchFromBackend<{ groups: Array<{ id: number; name: string }> }>("/groups");
    const second = await fetchFromBackend<{ groups: Array<{ id: number; name: string }> }>("/groups");

    expect(first.groups).toHaveLength(1);
    expect(second.groups).toHaveLength(1);
    expect(second.groups[0]?.name).toBe("Trip");
  });

  it("replays queued requests with the latest token from localStorage", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await fetchFromBackend("/groups/1/expenses", {
      method: "POST",
      token: "stale-token",
      body: JSON.stringify({ title: "Queued" }),
    });

    window.localStorage.setItem("splitmates.token", "fresh-token");
    fetchMock.mockResolvedValueOnce(jsonResponse({ expense: { id: 10 } }, 200));

    const result = await syncPendingBackendRequests();

    expect(result).toEqual({ synced: 1, remaining: 0 });

    const replayCall = fetchMock.mock.calls[1];
    const replayInit = replayCall?.[1] as RequestInit | undefined;
    const authHeader = new Headers(replayInit?.headers).get("authorization");
    expect(authHeader).toBe("Bearer fresh-token");
    expect(readQueue()).toHaveLength(0);
  });

  it("does not fallback to cache for GET when backend returns non-unreachable error", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ groups: [{ id: 1, name: "Trip" }] }))
      .mockResolvedValueOnce(jsonResponse({ error: "Forbidden" }, 403));

    await fetchFromBackend("/groups");
    await expect(fetchFromBackend("/groups")).rejects.toMatchObject({
      message: "Forbidden",
      status: 403,
    });
  });

  it("queues offline expense POST requests when backend is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ error: "Backend server is unreachable.", code: "BACKEND_UNREACHABLE" }, 503),
    );

    const result = await fetchFromBackend<{ expense: { id: number; title: string } }>("/groups/42/expenses", {
      method: "POST",
      body: JSON.stringify({ title: "Offline expense" }),
      token: "token-a",
    });

    expect(result.expense.id).toBeLessThan(0);
    expect(result.expense.title).toBe("Offline expense");
    expect(readQueue()).toHaveLength(1);
  });

  it("returns optimistic offline payloads for expense update and delete operations", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const createExpense = await fetchFromBackend<{ expense: { id: number; title: string } }>("/groups/42/expenses", {
      method: "POST",
      body: JSON.stringify({ title: "Offline" }),
    });
    const patchExpense = await fetchFromBackend<{ expense: { id: number; title: string } }>("/groups/42/expenses/7", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });
    const deleteExpense = await fetchFromBackend<{ expense: { id: number } }>("/groups/42/expenses/7", {
      method: "DELETE",
    });

    expect(createExpense.expense.id).toBeLessThan(0);
    expect(createExpense.expense.title).toBe("Offline");
    expect(patchExpense.expense.id).toBe(7);
    expect(patchExpense.expense.title).toBe("Updated");
    expect(deleteExpense.expense.id).toBe(7);
  });

  it("returns optimistic offline payload for generator controls", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));

    const start = await fetchFromBackend<{ status: { running: boolean; groupId: number | null } }>("/generator/start", {
      method: "POST",
      body: JSON.stringify({ groupId: 9 }),
    });
    const stop = await fetchFromBackend<{ status: { running: boolean } }>("/generator/stop", {
      method: "POST",
    });

    expect(start.status.running).toBe(true);
    expect(start.status.groupId).toBe(9);
    expect(stop.status.running).toBe(false);
  });

  it("serializes URLSearchParams, FormData and Blob bodies in offline queue", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));

    await fetchFromBackend("/groups/42/expenses", {
      method: "POST",
      body: new URLSearchParams({ name: "QueryGroup" }),
    });

    const form = new FormData();
    form.set("title", "FormGroup");
    await fetchFromBackend("/groups/42/expenses", {
      method: "POST",
      body: form,
    });

    await fetchFromBackend("/groups/42/expenses", {
      method: "POST",
      body: new Blob(["blob-body"], { type: "text/plain" }),
    });

    const queueRaw = window.localStorage.getItem("splitmates.offline.queue");
    const queue = queueRaw ? (JSON.parse(queueRaw) as Array<{ init?: { body?: unknown } }>) : [];

    expect(queue).toHaveLength(3);
    expect(queue[0]?.init?.body).toBe("name=QueryGroup");
    expect(String(queue[1]?.init?.body)).toContain("FormGroup");
    expect(queue[2]?.init?.body).toBeNull();
  });

  it("parses non-JSON text responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("plain text", { status: 200 }),
    );

    const result = await fetchFromBackend<string>("/health");
    expect(result).toBe("plain text");
  });

  it("returns null for empty successful body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await fetchFromBackend<null>("/health");
    expect(result).toBeNull();
  });

  it("falls back safely when offline cache storage is invalid JSON", async () => {
    window.localStorage.setItem("splitmates.offline.cache", "not-json");
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(fetchFromBackend("/groups")).rejects.toBeInstanceOf(BackendError);
  });

  it("keeps full queue tail when first replay fails", async () => {
    window.localStorage.setItem(
      "splitmates.offline.queue",
      JSON.stringify([
        {
          path: "/groups/1/expenses",
          init: { method: "POST", body: JSON.stringify({ title: "One" }), token: "token-a" },
          timestamp: Date.now(),
        },
        {
          path: "/groups/1/expenses",
          init: { method: "POST", body: JSON.stringify({ title: "Two" }), token: "token-a" },
          timestamp: Date.now() + 1,
        },
      ]),
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ error: "Backend server is unreachable." }, 503));

    const result = await syncPendingBackendRequests();

    expect(result).toEqual({ synced: 0, remaining: 2 });
    expect(readQueue()).toHaveLength(2);
  });

  it("returns zero sync result for empty queue", async () => {
    const result = await syncPendingBackendRequests();
    expect(result).toEqual({ synced: 0, remaining: 0 });
  });

  it("keeps queue item when 401 and refreshed-token retry still fails", async () => {
    window.localStorage.setItem(
      "splitmates.offline.queue",
      JSON.stringify([
        {
          path: "/groups/1/expenses",
          init: { method: "POST", body: JSON.stringify({ title: "One" }), token: "stale" },
          timestamp: Date.now(),
        },
      ]),
    );
    window.localStorage.setItem("splitmates.token", "fresh");

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: "Still unauthorized" }, 401));

    const result = await syncPendingBackendRequests();
    expect(result).toEqual({ synced: 0, remaining: 1 });
    expect(readQueue()).toHaveLength(1);
  });

  it("keeps queue item when 401 occurs and there is no refreshed token", async () => {
    window.localStorage.setItem(
      "splitmates.offline.queue",
      JSON.stringify([
        {
          path: "/groups/1/expenses",
          init: { method: "POST", body: JSON.stringify({ title: "One" }), token: "stale" },
          timestamp: Date.now(),
        },
      ]),
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401));

    const result = await syncPendingBackendRequests();
    expect(result).toEqual({ synced: 0, remaining: 1 });
    expect(readQueue()).toHaveLength(1);
  });

  it("keeps unsynced tail when later queued item fails after one success", async () => {
    window.localStorage.setItem(
      "splitmates.offline.queue",
      JSON.stringify([
        {
          path: "/groups/1/expenses",
          init: { method: "POST", body: JSON.stringify({ title: "One" }), token: "token-a" },
          timestamp: Date.now(),
        },
        {
          path: "/groups/1/expenses",
          init: { method: "POST", body: JSON.stringify({ title: "Two" }), token: "token-a" },
          timestamp: Date.now() + 1,
        },
      ]),
    );

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ expense: { id: 1 } }, 200))
      .mockResolvedValueOnce(jsonResponse({ error: "Backend down" }, 503));

    const result = await syncPendingBackendRequests();
    expect(result).toEqual({ synced: 1, remaining: 1 });
    expect(readQueue()).toHaveLength(1);
  });

  it("wraps unknown errors in BackendError", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("boom"));

    await expect(fetchFromBackend("/groups")).rejects.toBeInstanceOf(BackendError);
  });
});

describe("offline expense cache helpers", () => {
  const cacheKey = "/groups/7/expenses?page=1&pageSize=20&sortBy=date&sortOrder=desc";
  const detailKey = "/groups/7/expenses/3";
  const otherGroupKey = "/groups/8/expenses?page=1&pageSize=20";

  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem(
      "splitmates.offline.cache",
      JSON.stringify({
        [cacheKey]: {
          items: [{ id: 1, title: "Rent", amount: 100 }],
          totalItems: 1,
          page: 1,
          pageSize: 20,
        },
        [detailKey]: { expense: { id: 3, title: "Detail" } },
        [otherGroupKey]: {
          items: [{ id: 99, title: "Other group" }],
          totalItems: 1,
          page: 1,
          pageSize: 20,
        },
      }),
    );
  });

  function readCache() {
    const raw = window.localStorage.getItem("splitmates.offline.cache");
    return raw ? (JSON.parse(raw) as Record<string, { items?: Array<{ id: number; title?: string }>; totalItems?: number }>) : {};
  }

  it("adds an expense to all matching list cache entries for the group only", () => {
    addExpenseToOfflineCache(7, { id: -42, title: "Offline coffee", amount: 12 });

    const cache = readCache();
    expect(cache[cacheKey]?.items?.[0]?.id).toBe(-42);
    expect(cache[cacheKey]?.totalItems).toBe(2);
    expect(cache[otherGroupKey]?.items?.length).toBe(1);
  });

  it("does not duplicate an existing expense when adding", () => {
    addExpenseToOfflineCache(7, { id: 1, title: "Rent revised" });

    const cache = readCache();
    expect(cache[cacheKey]?.items?.length).toBe(1);
    expect(cache[cacheKey]?.totalItems).toBe(1);
  });

  it("updates an existing expense in the list cache", () => {
    updateExpenseInOfflineCache(7, { id: 1, title: "Rent (updated)", amount: 200 });

    const cache = readCache();
    expect(cache[cacheKey]?.items?.[0]?.title).toBe("Rent (updated)");
  });

  it("removes the expense without touching detail or other groups", () => {
    removeExpenseFromOfflineCache(7, 1);

    const cache = readCache();
    expect(cache[cacheKey]?.items?.length).toBe(0);
    expect(cache[cacheKey]?.totalItems).toBe(0);
    expect(cache[detailKey]).toBeDefined();
    expect(cache[otherGroupKey]?.items?.length).toBe(1);
  });

  it("hides tombstoned expenses from a fresh GET response after offline delete + reconnect", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    markExpenseDeleted(7, 1);
    await fetchFromBackend("/groups/7/expenses/1", { method: "DELETE" });

    
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          { id: 1, title: "Rent", amount: 100 },
          { id: 2, title: "Groceries", amount: 40 },
        ],
        totalItems: 2,
        page: 1,
        pageSize: 20,
      }),
    );
    const fresh = await fetchFromBackend<{ items: Array<{ id: number }>; totalItems: number }>(
      "/groups/7/expenses?page=1&pageSize=20&sortBy=date&sortOrder=desc",
    );

    expect(fresh.items.map((item) => item.id)).toEqual([2]);
    expect(fresh.totalItems).toBe(1);

    
    fetchMock.mockResolvedValueOnce(jsonResponse({ expense: { id: 1 } }, 200));
    const syncResult = await syncPendingBackendRequests();
    expect(syncResult).toEqual({ synced: 1, remaining: 0 });

    
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [{ id: 2, title: "Groceries", amount: 40 }], totalItems: 1, page: 1, pageSize: 20 }),
    );
    const next = await fetchFromBackend<{ items: Array<{ id: number }>; totalItems: number }>(
      "/groups/7/expenses?page=1&pageSize=20&sortBy=date&sortOrder=desc",
    );
    expect(next.items.map((item) => item.id)).toEqual([2]);
  });

  it("treats 404 from a queued DELETE replay as success and clears the tombstone", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    markExpenseDeleted(7, 99);
    await fetchFromBackend("/groups/7/expenses/99", { method: "DELETE" });

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Not found" }, 404));
    const result = await syncPendingBackendRequests();

    expect(result).toEqual({ synced: 1, remaining: 0 });

    
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [{ id: 99, title: "Ghost" }], totalItems: 1, page: 1, pageSize: 20 }),
    );
    const next = await fetchFromBackend<{ items: Array<{ id: number }> }>(
      "/groups/7/expenses?page=1&pageSize=20",
    );
    expect(next.items.map((item) => item.id)).toEqual([99]);
  });

  it("dedupes concurrent syncPendingBackendRequests calls", async () => {
    window.localStorage.setItem(
      "splitmates.offline.queue",
      JSON.stringify([
        {
          path: "/groups/1/expenses/5",
          init: { method: "DELETE", token: "token-a" },
          timestamp: Date.now(),
        },
      ]),
    );

    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(jsonResponse({ expense: { id: 5 } }, 200));

    const [first, second] = await Promise.all([
      syncPendingBackendRequests(),
      syncPendingBackendRequests(),
    ]);

    
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ synced: 1, remaining: 0 });
    expect(second).toEqual({ synced: 1, remaining: 0 });
  });

  it("ignores non-matching cache keys and missing items array safely", () => {
    window.localStorage.setItem(
      "splitmates.offline.cache",
      JSON.stringify({
        [cacheKey]: { something: "else" },
        "/groups/7/expensesfoo": { items: [{ id: 5 }], totalItems: 1 },
      }),
    );

    addExpenseToOfflineCache(7, { id: -1, title: "noop" });
    updateExpenseInOfflineCache(7, { id: 5, title: "ghost" });
    removeExpenseFromOfflineCache(7, 5);

    const cache = readCache();
    expect(cache[cacheKey]).toEqual({ something: "else" });
    expect(cache["/groups/7/expensesfoo"]?.items?.[0]?.id).toBe(5);
  });
});
