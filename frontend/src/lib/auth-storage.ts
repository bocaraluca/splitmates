const TOKEN_KEY = "splitmates.token";
const USERNAME_KEY = "splitmates.username";
const ROLE_KEY = "splitmates.role";
const PERMISSIONS_KEY = "splitmates.permissions";

export const DEFAULT_USERNAME = "User";

function isInBrowser() {
  return typeof window !== "undefined";
}

export function getToken() {
  if (!isInBrowser()) {
    return null;
  }

  return window.localStorage.getItem(TOKEN_KEY);
}

export function getUsername() {
  if (!isInBrowser()) {
    return DEFAULT_USERNAME;
  }

  return window.localStorage.getItem(USERNAME_KEY) ?? DEFAULT_USERNAME;
}

export function login(username: string, token: string, role?: string, permissions: string[] = []) {
  if (!isInBrowser()) {
    return;
  }

  window.localStorage.setItem(USERNAME_KEY, username);
  window.localStorage.setItem(TOKEN_KEY, token);
  if (role) {
    window.localStorage.setItem(ROLE_KEY, role);
  } else {
    window.localStorage.removeItem(ROLE_KEY);
  }
  window.localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
}

export function logout() {
  if (!isInBrowser()) {
    return;
  }

  window.localStorage.removeItem(USERNAME_KEY);
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ROLE_KEY);
  window.localStorage.removeItem(PERMISSIONS_KEY);
}

export function getRole() {
  if (!isInBrowser()) {
    return null;
  }

  return window.localStorage.getItem(ROLE_KEY);
}

export function getPermissions() {
  if (!isInBrowser()) {
    return [] as string[];
  }

  const raw = window.localStorage.getItem(PERMISSIONS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((permission) => typeof permission === "string") : [];
  } catch {
    return [];
  }
}
