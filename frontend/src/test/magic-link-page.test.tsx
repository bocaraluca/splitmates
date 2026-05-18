import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MagicLinkPage } from "@/components/pages/auth/magic-link-page";

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

describe("MagicLinkPage", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  it("renders email field and send button", () => {
    render(<MagicLinkPage />);
    expect(screen.getByPlaceholderText("email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send link/i })).toBeInTheDocument();
  });

  it("shows success state after email is submitted", async () => {
    fetchFromBackend.mockResolvedValue({ message: "A login link has been sent to your email." });
    render(<MagicLinkPage />);

    fireEvent.change(screen.getByPlaceholderText("email"), { target: { value: "test@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: /send link/i }).closest("form")!);

    await waitFor(() => {
      expect(fetchFromBackend).toHaveBeenCalledWith("/auth/magic-link", expect.objectContaining({ method: "POST" }));
      expect(screen.getByText(/check your inbox/i)).toBeInTheDocument();
    });
  });

  it("hides the form after successful submission", async () => {
    fetchFromBackend.mockResolvedValue({ message: "A login link has been sent to your email." });
    render(<MagicLinkPage />);

    fireEvent.change(screen.getByPlaceholderText("email"), { target: { value: "test@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: /send link/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText("email")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /send link/i })).not.toBeInTheDocument();
    });
  });

  it("shows error message on failed submission", async () => {
    fetchFromBackend.mockRejectedValue(new Error("Unable to send login link."));
    render(<MagicLinkPage />);

    fireEvent.change(screen.getByPlaceholderText("email"), { target: { value: "test@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: /send link/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Unable to send login link.")).toBeInTheDocument();
    });
  });
});
