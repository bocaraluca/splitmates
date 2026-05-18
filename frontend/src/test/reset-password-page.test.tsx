import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordPage } from "@/components/pages/auth/reset-password-page";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => key === "token" ? "valid-token-abc123" : null,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const { fetchFromBackend } = vi.hoisted(() => ({
  fetchFromBackend: vi.fn(),
}));

vi.mock("@/lib/backend-api", () => ({ fetchFromBackend }));

describe("ResetPasswordPage", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  it("renders password fields and reset button", () => {
    const { container } = render(<ResetPasswordPage />);
    expect(container.querySelector('input[name="password"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="confirmPassword"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset password/i })).toBeInTheDocument();
  });

  it("redirects to login on successful reset", async () => {
    fetchFromBackend.mockResolvedValue({ message: "Password has been reset successfully." });
    const { container } = render(<ResetPasswordPage />);

    fireEvent.change(container.querySelector('input[name="password"]')!, { target: { value: "newpassword123" } });
    fireEvent.change(container.querySelector('input[name="confirmPassword"]')!, { target: { value: "newpassword123" } });
    fireEvent.submit(screen.getByRole("button", { name: /reset password/i }).closest("form")!);

    await waitFor(() => {
      expect(fetchFromBackend).toHaveBeenCalledWith("/auth/reset-password", expect.objectContaining({ method: "POST" }));
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("shows error message on invalid or expired token", async () => {
    fetchFromBackend.mockRejectedValue(new Error("Invalid or expired token."));
    const { container } = render(<ResetPasswordPage />);

    fireEvent.change(container.querySelector('input[name="password"]')!, { target: { value: "newpassword123" } });
    fireEvent.change(container.querySelector('input[name="confirmPassword"]')!, { target: { value: "newpassword123" } });
    fireEvent.submit(screen.getByRole("button", { name: /reset password/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Invalid or expired token.")).toBeInTheDocument();
    });
  });
});
