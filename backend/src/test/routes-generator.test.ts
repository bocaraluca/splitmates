import { describe, expect, it, vi } from "vitest";
import { POST as startPOST } from "@/app/api/generator/start/route";
import { POST as stopPOST } from "@/app/api/generator/stop/route";

const deps = vi.hoisted(() => ({
  startGenerator: vi.fn(),
  stopGenerator: vi.fn(),
  getCurrentUserFromRequest: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("@/lib/splitmates", () => deps);

describe("POST /api/generator/start", () => {
  it("returns 401 when user is not logged in", async () => {
    deps.getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const res = await startPOST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ groupId: 1 }) }));
    expect(res.status).toBe(401);
  });

  it("starts generator with valid payload", async () => {
    deps.startGenerator.mockResolvedValueOnce({ running: true });
    const res = await startPOST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ groupId: 1 }) }));
    expect(res.status).toBe(200);
    expect(deps.startGenerator).toHaveBeenCalledWith(1);
  });

  it("starts generator without groupId falling back to null", async () => {
    deps.startGenerator.mockResolvedValueOnce({ running: true });
    const res = await startPOST(new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(200);
    expect(deps.startGenerator).toHaveBeenCalledWith(null);
  });

  it("handles validation error", async () => {
    const res = await startPOST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ groupId: "invalid" }) }));
    expect(res.status).toBe(400);
  });

  it("handles non-Error thrown in catch block", async () => {
    deps.startGenerator.mockRejectedValueOnce("String error thrown");
    const res = await startPOST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ groupId: 1 }) }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/generator/stop", () => {
  it("returns 401 when user is not logged in", async () => {
    deps.getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const res = await stopPOST();
    expect(res.status).toBe(401);
  });

  it("stops generator successfully", async () => {
    deps.stopGenerator.mockReturnValueOnce({ running: false });
    const res = await stopPOST();
    expect(res.status).toBe(200);
  });

  it("handles error when stopping generator", async () => {
    deps.stopGenerator.mockImplementationOnce(() => { throw new Error("Cannot stop"); });
    const res = await stopPOST();
    expect(res.status).toBe(400);
  });
});