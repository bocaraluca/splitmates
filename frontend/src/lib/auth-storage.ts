const TOKEN_KEY = "splitmates.token";
const USERNAME_KEY = "splitmates.username";

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

export function login(username: string, token: string) {
  if (!isInBrowser()) {
    return;
  }

  window.localStorage.setItem(USERNAME_KEY, username);
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function logout() {
  if (!isInBrowser()) {
    return;
  }

  window.localStorage.removeItem(USERNAME_KEY);
  window.localStorage.removeItem(TOKEN_KEY);
}
