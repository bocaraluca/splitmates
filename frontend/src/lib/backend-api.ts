import {
  isBackendUnavailableError,
  isBrowser,
  isOfflineNetworkError,
  parseStoredBody,
  readJson,
  serializeBody,
  serializeHeaders,
  writeJson,
} from "./offline-client";
import { getToken } from "./auth-storage";

export class BackendError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "BackendError";
    this.status = status;
    this.payload = payload;
  }
}

type SerializedHeaders = Array<[string, string]>;

interface OfflineQueueItem {
  path: string;
  init: {
    method?: string;
    headers?: SerializedHeaders;
    body?: string | null;
    token?: string;
  };
  timestamp: number;
}

const OFFLINE_QUEUE_STORAGE_KEY = "splitmates.offline.queue";
const OFFLINE_CACHE_STORAGE_KEY = "splitmates.offline.cache";
const PENDING_DELETIONS_STORAGE_KEY = "splitmates.offline.pendingExpenseDeletions";
const USER_ID_STORAGE_KEY = "splitmates.userId";

function buildApiUrl(path: string) {
  return `/api/backend${path.startsWith("/") ? path : `/${path}`}`;
}

export function backendWebSocketUrl(path = "/ws") {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:4000";
  return new URL(path, baseUrl).toString();
}

export function backendSocketUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:4000";
  const url = new URL(baseUrl);

  if (url.protocol === "ws:") {
    url.protocol = "http:";
  } else if (url.protocol === "wss:") {
    url.protocol = "https:";
  }

  url.pathname = "";
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
}

export function getCurrentClientUserId() {
  return readCurrentClientUserId();
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function buildHeaders(token?: string, headers?: HeadersInit) {
  const merged = new Headers(headers);
  if (!merged.has("content-type")) {
    merged.set("content-type", "application/json");
  }
  if (token) {
    merged.set("authorization", `Bearer ${token}`);
  }
  return merged;
}

function readOfflineQueue() {
  return readJson<OfflineQueueItem[]>(OFFLINE_QUEUE_STORAGE_KEY, []);
}

function writeOfflineQueue(queue: OfflineQueueItem[]) {
  writeJson(OFFLINE_QUEUE_STORAGE_KEY, queue);
}

function readCurrentClientUserId() {
  if (!isBrowser()) {
    return null;
  }

  const storedUserId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  const parsedUserId = storedUserId ? Number(storedUserId) : NaN;
  if (Number.isInteger(parsedUserId) && parsedUserId > 0) {
    return parsedUserId;
  }

  const token = getToken();
  const match = token ? /^session-(\d+)-\d+$/.exec(token) : null;
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function addUserIdToQuery(path: string, userId: number | null) {
  if (!userId) {
    return path;
  }

  try {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(normalizedPath, "http://localhost");
    if (!url.searchParams.has("userId")) {
      url.searchParams.set("userId", String(userId));
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return path;
  }
}

function readOfflineCache() {
  return readJson<Record<string, unknown>>(OFFLINE_CACHE_STORAGE_KEY, {});
}

function writeOfflineCache(cache: Record<string, unknown>) {
  writeJson(OFFLINE_CACHE_STORAGE_KEY, cache);
}

function isMutation(method: string) {
  return !["GET", "HEAD"].includes(method.toUpperCase());
}

function generateTempId() {
  return -Math.floor(Date.now() + Math.random() * 1000);
}

function modifyOfflineCache(updater: (cache: Record<string, unknown>) => void) {
  const cache = readOfflineCache();
  updater(cache);
  writeOfflineCache(cache);
}

type PendingDeletionMap = Record<string, number[]>;

function readPendingDeletions(): PendingDeletionMap {
  return readJson<PendingDeletionMap>(PENDING_DELETIONS_STORAGE_KEY, {});
}

function writePendingDeletions(map: PendingDeletionMap) {
  writeJson(PENDING_DELETIONS_STORAGE_KEY, map);
}

export function markExpenseDeletionPending(groupId: number, expenseId: number) {
  const map = readPendingDeletions();
  const key = String(groupId);
  const existing = map[key] ?? [];
  if (!existing.includes(expenseId)) {
    map[key] = [...existing, expenseId];
    writePendingDeletions(map);
  }
}

function clearExpenseDeletionPending(groupId: number, expenseId: number) {
  const map = readPendingDeletions();
  const key = String(groupId);
  const existing = map[key];
  if (!existing || !existing.includes(expenseId)) {
    return;
  }

  const next = existing.filter((id) => id !== expenseId);
  if (next.length === 0) {
    delete map[key];
  } else {
    map[key] = next;
  }
  writePendingDeletions(map);
}

function getPendingDeletionsForGroup(groupId: number): Set<number> {
  const map = readPendingDeletions();
  return new Set(map[String(groupId)] ?? []);
}

export function markExpenseDeleted(groupId: number, expenseId: number) {
  removeExpenseFromOfflineCache(groupId, expenseId);
  markExpenseDeletionPending(groupId, expenseId);
}

function parseExpenseListPath(path: string): { groupId: number } | null {
  const normalizedPath = path.split("?")[0];
  const parts = normalizedPath.split("/").filter(Boolean);
  if (parts.length !== 3 || parts[0] !== "groups" || parts[2] !== "expenses") {
    return null;
  }
  const groupId = Number(parts[1]);
  return Number.isFinite(groupId) ? { groupId } : null;
}

function parseExpenseDetailPath(path: string): { groupId: number; expenseId: number } | null {
  const normalizedPath = path.split("?")[0];
  const parts = normalizedPath.split("/").filter(Boolean);
  if (parts.length !== 4 || parts[0] !== "groups" || parts[2] !== "expenses") {
    return null;
  }
  const groupId = Number(parts[1]);
  const expenseId = Number(parts[3]);
  if (!Number.isFinite(groupId) || !Number.isFinite(expenseId)) {
    return null;
  }
  return { groupId, expenseId };
}

function applyPendingDeletionsToExpenseList<T>(path: string, data: T): T {
  const list = parseExpenseListPath(path);
  if (!list) {
    return data;
  }

  const tombstoned = getPendingDeletionsForGroup(list.groupId);
  if (tombstoned.size === 0) {
    return data;
  }

  if (typeof data !== "object" || data === null || !("items" in data)) {
    return data;
  }

  const payload = data as { items?: unknown; totalItems?: unknown };
  if (!Array.isArray(payload.items)) {
    return data;
  }

  const items = payload.items as Array<Record<string, unknown>>;
  const filtered = items.filter((item) => !tombstoned.has(Number(item.id ?? null)));
  if (filtered.length === items.length) {
    return data;
  }

  const removed = items.length - filtered.length;
  const next: Record<string, unknown> = { ...(data as Record<string, unknown>), items: filtered };
  if (typeof payload.totalItems === "number") {
    next.totalItems = Math.max(0, payload.totalItems - removed);
  }
  return next as T;
}

function isPendingDeletedExpenseDetail(path: string): boolean {
  const detail = parseExpenseDetailPath(path);
  if (!detail) {
    return false;
  }
  return getPendingDeletionsForGroup(detail.groupId).has(detail.expenseId);
}

function buildOfflineMutationResponse<T>(path: string, init: RequestInit & { token?: string }) {
  const method = (init.method ?? "GET").toUpperCase();
  const body = parseStoredBody(serializeBody(init.body));
  const normalizedPath = path.split("?")[0];
  const parts = normalizedPath.split("/").filter(Boolean);

  if (parts[0] === "auth") {
    throw new BackendError("Authentication requires the backend.", 503, null);
  }

  if (parts[0] === "groups" && method !== "GET" && !normalizedPath.includes("/expenses")) {
    throw new BackendError("You are offline. Group changes require the backend.", 503, null);
  }

  if (parts[0] === "groups" && parts.length === 3 && parts[2] === "expenses" && method === "POST") {
    return { expense: { id: generateTempId(), ...(body && typeof body === "object" ? body as Record<string, unknown> : {}) } } as T;
  }

  if (parts[0] === "groups" && parts.length === 4 && parts[2] === "expenses") {
    const expenseId = Number(parts[3]);
    if (method === "DELETE") {
      return { expense: { id: expenseId } } as T;
    }

    if (method === "PATCH") {
      return { expense: { id: expenseId, ...(body && typeof body === "object" ? body as Record<string, unknown> : {}) } } as T;
    }
  }

  if (parts[0] === "generator") {
    return {
      status: {
        running: parts[1] === "start",
        intervalMs: 2000,
        generatedCount: 0,
        groupId: body && typeof body === "object" && "groupId" in body ? Number((body as { groupId?: unknown }).groupId ?? null) : null,
      },
    } as T;
  }

  return body as T;
}

async function executeBackendFetch<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
  options: { cacheGet: boolean },
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const response = await fetch(buildApiUrl(path), {
    method,
    headers: buildHeaders(init.token, init.headers),
    body:
      typeof init.body === "string" || init.body instanceof FormData || init.body instanceof URLSearchParams
        ? init.body
        : init.body
        ? JSON.stringify(init.body)
        : undefined,
    credentials: "include",
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed with status ${response.status}`;
    throw new BackendError(message, response.status, data);
  }

  if (options.cacheGet && method === "GET") {
    const filtered = applyPendingDeletionsToExpenseList(path, data);
    const cache = readOfflineCache();
    cache[path] = filtered;
    writeOfflineCache(cache);
    return filtered as T;
  }

  return data as T;
}

export async function fetchFromBackend<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();

  if (method === "GET" && isPendingDeletedExpenseDetail(path)) {
    throw new BackendError("Expense was deleted.", 404, null);
  }

  try {
    return await executeBackendFetch<T>(path, init, { cacheGet: true });
  } catch (error) {
    if (method === "GET" && (isOfflineNetworkError(error) || isBackendUnavailableError(error))) {
      const cached = readOfflineCache()[path];
      if (cached !== undefined) {
        return applyPendingDeletionsToExpenseList(path, cached as T);
      }
    }

    if (isMutation(method) && (isOfflineNetworkError(error) || isBackendUnavailableError(error))) {
      const normalizedPath = path.split("?")[0];
      const firstSegment = normalizedPath.split("/").filter(Boolean)[0];
      const shouldNotQueue = firstSegment === "auth" || firstSegment === "notifications";
      if (!shouldNotQueue) {
        const queue = readOfflineQueue();
        queue.push({
          path,
          init: {
            method,
            headers: serializeHeaders(init.headers),
            body: serializeBody(init.body),
            token: init.token,
          },
          timestamp: Date.now(),
        });
        writeOfflineQueue(queue);
      }
      return buildOfflineMutationResponse<T>(path, init);
    }

    if (error instanceof BackendError) {
      throw error;
    }

    throw new BackendError("Unable to reach the backend.", 503, error);
  }
}

function isExpenseListCacheKey(cacheKey: string, groupId: number) {
  const prefix = `/groups/${groupId}/expenses`;
  if (!cacheKey.startsWith(prefix)) {
    return false;
  }

  const tail = cacheKey.slice(prefix.length);
  return tail === "" || tail.startsWith("?");
}

function forEachExpenseListPayload(
  groupId: number,
  visit: (payload: Record<string, unknown>) => void,
) {
  modifyOfflineCache((cache) => {
    for (const [cacheKey, cacheValue] of Object.entries(cache)) {
      if (typeof cacheKey !== "string" || !isExpenseListCacheKey(cacheKey, groupId)) {
        continue;
      }

      if (typeof cacheValue !== "object" || cacheValue === null) {
        continue;
      }

      const payload = cacheValue as Record<string, unknown>;
      if (!Array.isArray(payload.items)) {
        continue;
      }

      visit(payload);
    }
  });
}

export function removeExpenseFromOfflineCache(groupId: number, expenseId: number) {
  forEachExpenseListPayload(groupId, (payload) => {
    const items = payload.items as Array<Record<string, unknown>>;
    const next = items.filter((item) => Number(item.id ?? null) !== expenseId);
    if (next.length === items.length) {
      return;
    }

    payload.items = next;
    if (typeof payload.totalItems === "number") {
      payload.totalItems = Math.max(0, payload.totalItems - 1);
    }
  });
}

export function addExpenseToOfflineCache(groupId: number, item: Record<string, unknown>) {
  forEachExpenseListPayload(groupId, (payload) => {
    const items = payload.items as Array<Record<string, unknown>>;
    if (items.some((existing) => Number(existing.id ?? null) === Number(item.id ?? null))) {
      return;
    }

    payload.items = [item, ...items];
    if (typeof payload.totalItems === "number") {
      payload.totalItems = payload.totalItems + 1;
    }
  });
}

export function updateExpenseInOfflineCache(groupId: number, item: Record<string, unknown>) {
  forEachExpenseListPayload(groupId, (payload) => {
    const items = payload.items as Array<Record<string, unknown>>;
    payload.items = items.map((existing) =>
      Number(existing.id ?? null) === Number(item.id ?? null) ? { ...existing, ...item } : existing,
    );
  });
}

interface SyncResult {
  synced: number;
  remaining: number;
}

let inFlightSync: Promise<SyncResult> | null = null;

async function replayQueueItem(item: OfflineQueueItem, token: string | undefined): Promise<void> {
  await executeBackendFetch(item.path, {
    method: item.init.method,
    headers: item.init.headers,
    body: item.init.body ?? undefined,
    token,
  }, { cacheGet: true });
}

function isAlreadyDeletedDelete(item: OfflineQueueItem, error: unknown): boolean {
  if (!(error instanceof BackendError) || error.status !== 404) {
    return false;
  }
  const method = (item.init.method ?? "GET").toUpperCase();
  return method === "DELETE";
}

function onQueueItemSynced(item: OfflineQueueItem) {
  const method = (item.init.method ?? "GET").toUpperCase();
  if (method !== "DELETE") {
    return;
  }

  const detail = parseExpenseDetailPath(item.path);
  if (detail) {
    clearExpenseDeletionPending(detail.groupId, detail.expenseId);
  }
}

async function drainOfflineQueue(): Promise<SyncResult> {
  if (!isBrowser()) {
    return { synced: 0, remaining: 0 };
  }

  const queue = readOfflineQueue();
  if (queue.length === 0) {
    return { synced: 0, remaining: 0 };
  }

  const remaining: OfflineQueueItem[] = [];
  let synced = 0;

  for (const [index, item] of queue.entries()) {
    try {
      const activeToken = getToken();
      const replayToken = activeToken ?? item.init.token;

      await replayQueueItem(item, replayToken);
      onQueueItemSynced(item);
      synced += 1;
    } catch (error) {
      if (isAlreadyDeletedDelete(item, error)) {
        onQueueItemSynced(item);
        synced += 1;
        continue;
      }

      if (error instanceof BackendError && error.status === 401) {
        const refreshedToken = getToken();
        const shouldRetryWithRefreshedToken = Boolean(refreshedToken) && refreshedToken !== item.init.token;

        if (shouldRetryWithRefreshedToken) {
          try {
            await replayQueueItem(item, refreshedToken ?? undefined);
            onQueueItemSynced(item);
            synced += 1;
            continue;
          } catch {

          }
        }

        const currentUserId = readCurrentClientUserId();
        if (currentUserId) {
          const fallbackPath = addUserIdToQuery(item.path, currentUserId);
          try {
            await replayQueueItem(
              { ...item, path: fallbackPath },
              refreshedToken ?? item.init.token,
            );
            onQueueItemSynced(item);
            synced += 1;
            continue;
          } catch {

          }
        }
      }

      remaining.push(...queue.slice(index));
      break;
    }
  }

  writeOfflineQueue(remaining);
  return { synced, remaining: remaining.length };
}

export async function syncPendingBackendRequests(): Promise<SyncResult> {
  if (inFlightSync) {
    return inFlightSync;
  }

  inFlightSync = drainOfflineQueue().finally(() => {
    inFlightSync = null;
  });
  return inFlightSync;
}
