import { beforeEach, describe, expect, it } from "vitest";
import { login, logout, getToken, getUsername, getRole, getPermissions, DEFAULT_USERNAME } from "@/lib/auth-storage";

describe("auth-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores and retrieves token after login", () => {
    login("testuser", "session-1-123456", "user", ["read"]);
    expect(getToken()).toBe("session-1-123456");
  });

  it("stores and retrieves username after login", () => {
    login("testuser", "session-1-123456", "user", ["read"]);
    expect(getUsername()).toBe("testuser");
  });

  it("stores and retrieves role after login", () => {
    login("testuser", "session-1-123456", "user", ["read"]);
    expect(getRole()).toBe("user");
  });

  it("stores and retrieves permissions after login", () => {
    login("testuser", "session-1-123456", "user", ["read", "write"]);
    expect(getPermissions()).toEqual(["read", "write"]);
  });

  it("clears all data after logout", () => {
    login("testuser", "session-1-123456", "user", ["read"]);
    logout();
    expect(getToken()).toBeNull();
    expect(getUsername()).toBe(DEFAULT_USERNAME);
    expect(getRole()).toBeNull();
    expect(getPermissions()).toEqual([]);
  });

  it("returns default username when not logged in", () => {
    expect(getUsername()).toBe(DEFAULT_USERNAME);
  });

  it("returns null token when not logged in", () => {
    expect(getToken()).toBeNull();
  });

  it("returns empty permissions when not logged in", () => {
    expect(getPermissions()).toEqual([]);
  });

  it("does not store role if not provided", () => {
    login("testuser", "session-1-123456");
    expect(getRole()).toBeNull();
  });
});