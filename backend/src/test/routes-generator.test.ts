import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/generator/start/route";

const deps = vi.hoisted(() => ({
  startGenerator: vi.fn(),
}));

vi.mock("@/lib/splitmates", () => deps);

describe("POST /api/generator/start", () => {
  it("starts generator with valid payload", async () => {
    deps.startGenerator.mockResolvedValueOnce({ running: true });
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ groupId: 1 }) }));
    expect(res.status).toBe(200);
    expect(deps.startGenerator).toHaveBeenCalledWith(1);
  });

  it("starts generator without groupId falling back to null", async () => {
    deps.startGenerator.mockResolvedValueOnce({ running: true });
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(200);
    expect(deps.startGenerator).toHaveBeenCalledWith(null);
  });

  it("handles validation error", async () => {
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ groupId: "invalid" }) }));
    expect(res.status).toBe(400);
  });

  it("handles non-Error thrown in catch block", async () => {
    deps.startGenerator.mockRejectedValueOnce("String error thrown");
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ groupId: 1 }) }));
    expect(res.status).toBe(400);
  });
});