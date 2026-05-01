export function isBrowser() {
  return typeof window !== "undefined";
}

export function readJson<T>(key: string, fallback: T) {
  if (!isBrowser()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function isOfflineNetworkError(error: unknown) {
  return error instanceof TypeError || (error instanceof Error && /fetch|network/i.test(error.message));
}

export function isBackendUnavailableError(error: unknown) {
  if (!(error instanceof Error) || error.name !== "BackendError") {
    return false;
  }

  const { status, payload } = error as Error & { status?: number; payload?: unknown };
  const code =
    typeof payload === "object" && payload && "code" in payload
      ? String((payload as { code?: unknown }).code ?? "")
      : "";

  return code === "BACKEND_UNREACHABLE" || [502, 503, 504].includes(Number(status ?? 0));
}

export function serializeHeaders(headers?: HeadersInit) {
  if (!headers) {
    return undefined;
  }

  return Array.from(new Headers(headers).entries());
}

export function serializeBody(body: RequestInit["body"]) {
  if (body == null) {
    return null;
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  if (body instanceof FormData) {
    return JSON.stringify(Array.from(body.entries()));
  }

  if (body instanceof Blob) {
    return null;
  }

  if (typeof body === "object") {
    return JSON.stringify(body);
  }

  return String(body);
}

export function parseStoredBody(body: string | null) {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}
