import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPage } from "@/components/pages/auth/auth-page";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const { fetchFromBackend } = vi.hoisted(() => ({
  fetchFromBackend: vi.fn(),
}));

vi.mock("@/lib/backend-api", () => ({ fetchFromBackend }));

const { login } = vi.hoisted(() => ({
    login: vi.fn(),
}));

vi.mock("@/lib/auth-storage", () => ({ login }));

const mockLoginResponse = {
  token: "session-1-123456",
  role: "user",
  permissions: ["read"],
  user: { username: "testuser" },
};

describe("AuthPage - login", () => {
    beforeEach(() => { vi.clearAllMocks(); });
    afterEach(() => { cleanup(); });

    it("renders identifier and password fields", () => {
        render(<AuthPage mode="login" />);
        expect(screen.getByPlaceholderText("username or email")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("password")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
    });

    it("redirects to dashboard on successful login", async () => {
        fetchFromBackend.mockResolvedValue(mockLoginResponse);
        render(<AuthPage mode="login" />);

        fireEvent.change(screen.getByPlaceholderText("username or email"), { target: { value: "testuser" } });
        fireEvent.change(screen.getByPlaceholderText("password"), { target: { value: "password123" } });
        fireEvent.submit(screen.getByRole("button", { name: /log in/i }).closest("form")!);

        await waitFor(() => {
        expect(fetchFromBackend).toHaveBeenCalledWith("/auth/login", expect.objectContaining({ method: "POST" }));
        expect(login).toHaveBeenCalledWith("testuser", "session-1-123456", "user", ["read"]);
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
        });
    });

    it("shows error message on failed login", async () => {
        fetchFromBackend.mockRejectedValue(new Error("Invalid credentials"));
        render(<AuthPage mode="login" />);

        fireEvent.change(screen.getByPlaceholderText("username or email"), { target: { value: "testuser" } });
        fireEvent.change(screen.getByPlaceholderText("password"), { target: { value: "wrongpassword" } });
        fireEvent.submit(screen.getByRole("button", { name: /log in/i }).closest("form")!);

        await waitFor(() => {
        expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
        });
    });
});

describe("AuthPage - signup", () => {
    beforeEach(() => { vi.clearAllMocks(); });
    afterEach(() => { cleanup(); });

    it("renders all signup fields", () => {
        render(<AuthPage mode="signup" />);
        expect(screen.getByPlaceholderText("username")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("email")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("password")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("confirm password")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
    });

    it("redirects to dashboard on successful signup", async () => {
        fetchFromBackend.mockResolvedValue(mockLoginResponse);
        render(<AuthPage mode="signup" />);

        fireEvent.change(screen.getByPlaceholderText("username"), { target: { value: "testuser" } });
        fireEvent.change(screen.getByPlaceholderText("email"), { target: { value: "test@example.com" } });
        fireEvent.change(screen.getByPlaceholderText("password"), { target: { value: "password123" } });
        fireEvent.change(screen.getByPlaceholderText("confirm password"), { target: { value: "password123" } });
        fireEvent.submit(screen.getByRole("button", { name: /sign up/i }).closest("form")!);

        await waitFor(() => {
        expect(fetchFromBackend).toHaveBeenCalledWith("/auth/signup", expect.objectContaining({ method: "POST" }));
        expect(login).toHaveBeenCalledWith("testuser", "session-1-123456", "user", ["read"]);
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
        });
    });

    it("shows error message on failed signup", async () => {
    fetchFromBackend.mockRejectedValue(new Error("Username already taken"));
    render(<AuthPage mode="signup" />);

    fireEvent.change(screen.getByPlaceholderText("username"), { target: { value: "existinguser" } });
    fireEvent.change(screen.getByPlaceholderText("email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByPlaceholderText("confirm password"), { target: { value: "password123" } });
    fireEvent.submit(screen.getByRole("button", { name: /sign up/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Username already taken")).toBeInTheDocument();
    });
  });
});