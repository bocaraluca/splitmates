import { describe, expect, it } from "vitest";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";

describe("http helpers", () => {
  it("returns structured success responses", async () => {
    const response = jsonOk({ ok: true }, 201);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns structured error responses", async () => {
    const response = jsonError("Nope", 403);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Nope" });
  });
});
