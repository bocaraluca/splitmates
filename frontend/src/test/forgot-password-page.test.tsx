import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordPage } from "@/components/pages/auth/forgot-password-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const { fetchFromBackend } = vi.hoisted(() => ({
  fetchFromBackend: vi.fn(),
}));

vi.mock("@/lib/backend-api", () => ({ fetchFromBackend }));

describe("ForgotPasswordPage", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  it("renders email field and send button", () => {
    const { container } = render(<ForgotPasswordPage />);
    expect(container.querySelector('input[name="email"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send link/i })).toBeInTheDocument();
  });

  it("shows success message after successful submission", async () => {
    fetchFromBackend.mockResolvedValue({ message: "A password reset link has been sent to your email." });
    const { container } = render(<ForgotPasswordPage />);

    fireEvent.change(container.querySelector('input[name="email"]')!, { target: { value: "test@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: /send link/i }).closest("form")!);

    await waitFor(() => {
      expect(fetchFromBackend).toHaveBeenCalledWith("/auth/forgot-password", expect.objectContaining({ method: "POST" }));
      expect(screen.getByText("A password reset link has been sent to your email.")).toBeInTheDocument();
    });
  });

  it("shows error message on failed submission", async () => {
    fetchFromBackend.mockRejectedValue(new Error("Unable to process request."));
    const { container } = render(<ForgotPasswordPage />);

    fireEvent.change(container.querySelector('input[name="email"]')!, { target: { value: "test@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: /send link/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Unable to process request.")).toBeInTheDocument();
    });
  });

  it("hides the form and shows success state after submission", async () => {
    fetchFromBackend.mockResolvedValue({ message: "A password reset link has been sent to your email." });
    const { container } = render(<ForgotPasswordPage />);

    fireEvent.change(container.querySelector('input[name="email"]')!, { target: { value: "test@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: /send link/i }).closest("form")!);

    await waitFor(() => {
      expect(container.querySelector('input[name="email"]')).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /send link/i })).not.toBeInTheDocument();
    });
  });
});
