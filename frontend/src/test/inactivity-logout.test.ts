import { renderHook, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const { getToken, logout } = vi.hoisted(() => ({
  getToken: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/lib/auth-storage", () => ({ getToken, logout }));

const { fetchFromBackend } = vi.hoisted(() => ({
  fetchFromBackend: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/backend-api", () => ({ fetchFromBackend }));

import { useInactivityLogout } from "@/lib/inactivity-logout";

describe("useInactivityLogout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    getToken.mockReturnValue("session-1-123456");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("logs out and redirects after inactivity timeout", async () => {
    renderHook(() => useInactivityLogout());

    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    expect(fetchFromBackend).toHaveBeenCalledWith("/auth/logout", expect.objectContaining({ method: "POST" }));
    expect(logout).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("does not log out if user is active before timeout", async () => {
    renderHook(() => useInactivityLogout());

    await act(async () => {
      vi.advanceTimersByTime(1 * 60 * 1000);
      window.dispatchEvent(new Event("mousemove"));
      vi.advanceTimersByTime(1 * 60 * 1000);
    });

    expect(logout).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not log out if there is no token", async () => {
    getToken.mockReturnValue(null);
    renderHook(() => useInactivityLogout());

    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    expect(logout).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});