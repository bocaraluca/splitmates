import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { POST as logoutPOST } from "@/app/api/auth/logout/route";
import * as authBarrel from "@/lib/splitmates/services/auth";
import * as generatorBarrel from "@/lib/splitmates/services/generator";
import { jsonClearSession, jsonError, jsonOk, jsonSessionOk } from "@/lib/splitmates/api/http";
import { clearSessionToken, resolveCurrentUser, resolveSessionToken, resolveToken, SESSION_COOKIE_NAME } from "@/lib/splitmates/services/auth/session";
import { formatValidationError } from "@/lib/splitmates/validation/errors";
import { loginUser, resetSplitmatesStateForTests } from "@/lib/splitmates";
import { paginationSchema } from "@/lib/splitmates/validation/schemas";

beforeEach(() => {
  resetSplitmatesStateForTests();
});

describe("runtime utility coverage", () => {
  it("covers api helpers and auth session helpers", async () => {
    expect(authBarrel.loginUser).toBe(loginUser);
    expect(generatorBarrel.startGenerator).toBeDefined();

    const token = loginUser({ identifier: "raluca", password: "raluca" }).token;

    const bearerRequest = new Request("http://localhost/api/test", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(resolveSessionToken(bearerRequest)).toBe(token);

    const cookieRequest = new Request("http://localhost/api/test", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` },
    });
    expect(resolveSessionToken(cookieRequest)).toBe(token);

    const unrelatedCookieRequest = new Request("http://localhost/api/test", {
      headers: { cookie: `theme=dark; lang=en` },
    });
    expect(resolveSessionToken(unrelatedCookieRequest)).toBeNull();

    expect(resolveToken(token)?.username).toBe("raluca");
    expect(resolveToken("missing-token")).toBeNull();

    expect(resolveCurrentUser(new Request("http://localhost/api/test?userId=2"))?.username).toBe("ana");
    expect(resolveCurrentUser(new Request("http://localhost/api/test"), 3)?.username).toBe("elena");
    expect(resolveCurrentUser(new Request("http://localhost/api/test"))).toBeNull();

    expect(() => clearSessionToken(undefined)).not.toThrow();
    clearSessionToken(token);
    expect(resolveToken(token)).toBeNull();

    const ok = jsonOk({ ok: true });
    expect(ok.status).toBe(200);

    const created = jsonSessionOk({ ok: true }, "token-value");
    expect(created.status).toBe(200);
    expect(created.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("token-value");

    const cleared = jsonClearSession();
    expect(cleared.status).toBe(200);
    expect(cleared.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("");

    const error = jsonError("Nope", 418);
    expect(error.status).toBe(418);
  });

  it("covers validation error formatting and logout", async () => {
    const zodError = new ZodError([
      {
        code: "custom",
        message: "Wrong value.",
        path: ["field"],
      },
    ]);
    expect(formatValidationError(zodError, "fallback")).toBe("Field: Wrong value.");
    expect(formatValidationError(new ZodError([]), "fallback")).toBe("fallback");
    expect(
      formatValidationError(
        new ZodError([
          {
            code: "custom",
            message: "Wrong value.",
            path: [],
          },
        ]),
        "fallback",
      ),
    ).toBe("Wrong value.");
    expect(formatValidationError(new Error("Boom"), "fallback")).toBe("Boom");
    expect(formatValidationError(null, "fallback")).toBe("fallback");

    expect(paginationSchema.parse({}).pageSize).toBe(5);

    const session = loginUser({ identifier: "ana", password: "raluca" });
    const response = await logoutPOST(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${session.token}` },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("");
    expect(resolveToken(session.token)).toBeNull();
  });
});
