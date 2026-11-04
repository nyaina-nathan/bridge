import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getServerAuthContext, requireAuth } from "@/lib/api/auth";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  authResponse,
  clearAuthCookies,
  errorResponse,
  refreshResponse,
  sessionResponse,
} from "@/lib/api/auth-response";
import { ApiClientError, postJson, putJson } from "@/lib/api/client";
import {
  ApiError,
  ERROR_STATUS,
  isApiError,
} from "@/lib/api/errors";
import { withErrorHandling } from "@/lib/api/handler";
import { jsonResponse } from "@/lib/api/json";
import type { AuthSession, AuthTokens } from "@/lib/types/auth.types";

const { unstableRethrow, cookiesMock, verifyAccessToken } = vi.hoisted(
  () => ({
    unstableRethrow: vi.fn(),
    cookiesMock: vi.fn(),
    verifyAccessToken: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  unstable_rethrow: unstableRethrow,
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/auth/jwt", () => ({
  verifyAccessToken,
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const COUPLE_ID = "22222222-2222-4222-8222-222222222222";

const session: AuthSession = {
  user: {
    id: USER_ID,
    displayName: "Ada",
    email: "ada@example.com",
  },
  couple: {
    id: COUPLE_ID,
    inviteCode: "ABC123",
    members: [{ id: USER_ID, displayName: "Ada" }],
  },
};

const tokens: AuthTokens = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
};

function cookieHeader(setCookies: string[], name: string): string {
  const value = setCookies.find((cookie) => cookie.startsWith(`${name}=`));

  if (!value) {
    throw new Error(`Cookie ${name} was not set`);
  }

  return value;
}

describe("lib/api/errors", () => {
  it("derives statuses from the error code", () => {
    expect(ERROR_STATUS.VALIDATION_ERROR).toBe(400);
    expect(ERROR_STATUS.UNAUTHORIZED).toBe(401);
    expect(ERROR_STATUS.PARTNER_NOT_JOINED).toBe(403);
    expect(ERROR_STATUS.CONFLICT_NOT_FOUND).toBe(404);
    expect(ERROR_STATUS.COUPLE_FULL).toBe(409);
    expect(ERROR_STATUS.RATE_LIMITED).toBe(429);
    expect(ERROR_STATUS.INTERNAL_ERROR).toBe(500);
  });

  it("uses default messages", () => {
    expect(new ApiError("CONFLICT_NOT_FOUND").message).toBe(
      "Conflict not found",
    );
    expect(new ApiError("UNAUTHORIZED")).toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("accepts a custom message and field-level errors", () => {
    const error = new ApiError("VALIDATION_ERROR", "Fix the form", {
      fields: { email: "Must be a valid email" },
    });

    expect(error.status).toBe(400);
    expect(error.message).toBe("Fix the form");
    expect(error.toJSON()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Fix the form",
        fields: { email: "Must be a valid email" },
      },
    });
  });

  it("omits the fields key when there are no field errors", () => {
    const body = new ApiError("ACTION_NOT_ALLOWED").toJSON();

    expect(body.error).not.toHaveProperty("fields");
  });

  it("exposes validated static constructors", () => {
    expect(ApiError.validation({ title: "Required" }).toJSON()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        fields: { title: "Required" },
      },
    });

    expect(ApiError.unauthorized().code).toBe("UNAUTHORIZED");
    expect(ApiError.unauthorized("INVALID_CREDENTIALS").status).toBe(401);
    expect(ApiError.invalidCredentials().code).toBe("INVALID_CREDENTIALS");
    expect(ApiError.invalidRefreshToken().code).toBe("INVALID_REFRESH_TOKEN");
    expect(ApiError.forbidden("PARTNER_NOT_JOINED").status).toBe(403);
    expect(ApiError.notFound("INVALID_INVITE_CODE").status).toBe(404);
    expect(ApiError.conflict("COUPLE_FULL").status).toBe(409);
  });

  it("adds a Retry-After header when rate limited", () => {
    const error = ApiError.rateLimited({ retryAfter: 30 });

    expect(error.code).toBe("RATE_LIMITED");
    expect(error.status).toBe(429);
    expect(error.headers).toEqual({ "Retry-After": "30" });
    expect(ApiError.rateLimited().headers).toBeUndefined();
  });

  it("keeps the internal cause without exposing it", () => {
    const cause = new Error("database exploded");
    const error = ApiError.internal(cause);

    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.message).toBe("Something went wrong");
    expect(error.cause).toBe(cause);
  });

  it("recognises ApiError instances and same-shaped values", () => {
    expect(isApiError(new ApiError("INTERNAL_ERROR"))).toBe(true);
    expect(
      isApiError({
        name: "ApiError",
        code: "INTERNAL_ERROR",
        status: 500,
        message: "Something went wrong",
        toJSON: () => ({}),
      }),
    ).toBe(true);
    expect(isApiError(null)).toBe(false);
    expect(isApiError("nope")).toBe(false);
    expect(
      isApiError({
        name: "ApiError",
        code: "NOT_A_CODE",
        status: 500,
        message: "x",
        toJSON: () => ({}),
      }),
    ).toBe(false);
  });
});

describe("lib/api/json", () => {
  it("returns JSON with no-store caching", async () => {
    const response = jsonResponse({ ok: true });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("supports a custom status", async () => {
    const response = jsonResponse({ ok: true }, 201);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

describe("lib/api/auth-response", () => {
  it("writes both auth cookies on register/login", async () => {
    const response = authResponse(session, tokens, 201);
    const setCookies = response.headers.getSetCookie();
    const access = cookieHeader(setCookies, ACCESS_TOKEN_COOKIE);
    const refresh = cookieHeader(setCookies, REFRESH_TOKEN_COOKIE);

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual(session);

    expect(access).toContain("access_token=access-token");
    expect(access).toContain("Path=/");
    expect(access).toContain("Max-Age=900");
    expect(access).toMatch(/HttpOnly/i);
    expect(access).toMatch(/SameSite=lax/i);

    expect(refresh).toContain("refresh_token=refresh-token");
    expect(refresh).toContain("Max-Age=2592000");
    expect(refresh).toMatch(/HttpOnly/i);
  });

  it("only marks cookies Secure in production", () => {
    const insecure = authResponse(session, tokens, 200)
      .headers.getSetCookie()
      .join("\n");

    expect(insecure).not.toMatch(/;\s*Secure/i);

    vi.stubEnv("NODE_ENV", "production");

    const secure = authResponse(session, tokens, 200)
      .headers.getSetCookie()
      .join("\n");

    expect(secure).toMatch(/;\s*Secure/i);
  });

  it("builds a session response without cookies", async () => {
    const response = sessionResponse(session);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.getSetCookie()).toEqual([]);
    await expect(response.json()).resolves.toEqual(session);
  });

  it("returns a 204 refresh with only the access cookie when not rotated", () => {
    const response = refreshResponse({ accessToken: "new-access" });
    const setCookies = response.headers.getSetCookie();

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.cookies.get(REFRESH_TOKEN_COOKIE)).toBeUndefined();
    expect(cookieHeader(setCookies, ACCESS_TOKEN_COOKIE)).toContain(
      "access_token=new-access",
    );
  });

  it("returns a rotated refresh token when one was issued", () => {
    const response = refreshResponse({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });

    expect(cookieHeader(response.headers.getSetCookie(), REFRESH_TOKEN_COOKIE))
      .toContain("refresh_token=new-refresh");
  });

  it("serialises ApiErrors with their headers", async () => {
    const error = ApiError.rateLimited({ retryAfter: 5 });
    const response = errorResponse(error);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("5");
    await expect(response.json()).resolves.toEqual(error.toJSON());
  });

  it("clears auth cookies when requested", async () => {
    const response = errorResponse(ApiError.unauthorized(), {
      clearCookies: true,
    });
    const setCookies = response.headers.getSetCookie();

    expect(cookieHeader(setCookies, ACCESS_TOKEN_COOKIE)).toContain(
      "Max-Age=0",
    );
    expect(cookieHeader(setCookies, REFRESH_TOKEN_COOKIE)).toContain(
      "Max-Age=0",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("clears both cookies on an arbitrary response", () => {
    const response = clearAuthCookies(NextResponse.json({ ok: true }));
    const setCookies = response.headers.getSetCookie();

    expect(cookieHeader(setCookies, ACCESS_TOKEN_COOKIE)).toContain(
      "access_token=",
    );
    expect(cookieHeader(setCookies, REFRESH_TOKEN_COOKIE)).toContain(
      "refresh_token=",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("lib/api/handler", () => {
  const request = new NextRequest("http://localhost/api/things", {
    method: "POST",
  });
  const context = { params: Promise.resolve<Record<string, string>>({}) };

  beforeEach(() => {
    unstableRethrow.mockReset();
    unstableRethrow.mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes successful responses through", async () => {
    const handler = withErrorHandling(async () =>
      NextResponse.json({ ok: true }, { status: 201 }),
    );

    const response = await handler(request, context);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("serialises ApiErrors and keeps their headers", async () => {
    const handler = withErrorHandling(async () => {
      throw ApiError.rateLimited({ retryAfter: 12 });
    });

    const response = await handler(request, context);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "RATE_LIMITED" },
    });
  });

  it("turns unknown errors into a generic 500 and logs them", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withErrorHandling(async () => {
      throw new Error("secret database detail");
    });

    const response = await handler(request, context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("secret database detail");
    expect(body).toMatchObject({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "[api] POST /api/things",
      expect.any(Error),
    );
  });

  it("rethrows Next.js control-flow errors via unstable_rethrow", async () => {
    const sentinel = Object.assign(new Error("redirect"), {
      digest: "NEXT_REDIRECT;replace;/login;307;",
    });
    unstableRethrow.mockImplementation((error: unknown) => {
      if ((error as { digest?: string }).digest) {
        throw error;
      }
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const handler = withErrorHandling(async () => {
      throw sentinel;
    });

    await expect(handler(request, context)).rejects.toBe(sentinel);
    expect(unstableRethrow).toHaveBeenCalledWith(sentinel);
  });
});

describe("lib/api/auth", () => {
  beforeEach(() => {
    verifyAccessToken.mockReset();
    cookiesMock.mockReset();
  });

  it("rejects requests without an access cookie", async () => {
    const request = new NextRequest("http://localhost/api/private");

    await expect(requireAuth(request)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it("rejects requests with an invalid access token", async () => {
    verifyAccessToken.mockResolvedValue(null);
    const request = new NextRequest("http://localhost/api/private", {
      headers: { cookie: `${ACCESS_TOKEN_COOKIE}=bad-token` },
    });

    await expect(requireAuth(request)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(verifyAccessToken).toHaveBeenCalledWith("bad-token");
  });

  it("returns the verified auth context", async () => {
    verifyAccessToken.mockResolvedValue({
      userId: USER_ID,
      coupleId: COUPLE_ID,
    });
    const request = new NextRequest("http://localhost/api/private", {
      headers: { cookie: `${ACCESS_TOKEN_COOKIE}=good-token` },
    });

    await expect(requireAuth(request)).resolves.toEqual({
      userId: USER_ID,
      coupleId: COUPLE_ID,
    });
  });

  it("reads the cookie store in server components", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ value: "server-token" })),
    });
    verifyAccessToken.mockResolvedValue({
      userId: USER_ID,
      coupleId: COUPLE_ID,
    });

    await expect(getServerAuthContext()).resolves.toEqual({
      userId: USER_ID,
      coupleId: COUPLE_ID,
    });
    expect(verifyAccessToken).toHaveBeenCalledWith("server-token");
  });

  it("returns null when the server component has no cookie", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn(() => undefined) });

    await expect(getServerAuthContext()).resolves.toBeNull();
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it("returns null when the server component token is invalid", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ value: "bad-token" })),
    });
    verifyAccessToken.mockResolvedValue(null);

    await expect(getServerAuthContext()).resolves.toBeNull();
  });
});

describe("lib/api/client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts same-origin JSON and returns the parsed body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "abc" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(postJson("/api/things", { title: "Hi" })).resolves.toEqual({
      id: "abc",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/things", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ title: "Hi" }),
    });
  });

  it("puts same-origin JSON and returns the parsed body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ summary: "I felt alone." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      putJson("/api/things/1", { summary: "I felt alone." }),
    ).resolves.toEqual({ summary: "I felt alone." });
    expect(fetchMock).toHaveBeenCalledWith("/api/things/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ summary: "I felt alone." }),
    });
  });

  it("returns null for an empty successful body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );

    await expect(postJson("/api/things", {})).resolves.toBeNull();
  });

  it("maps API error bodies onto ApiClientError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: "Validation failed",
              fields: { email: "Must be a valid email" },
            },
          }),
          { status: 400 },
        ),
      ),
    );

    await expect(postJson("/api/auth/login", {})).rejects.toMatchObject({
      name: "ApiClientError",
      status: 400,
      code: "VALIDATION_ERROR",
      fields: { email: "Must be a valid email" },
      message: "Validation failed",
    });
  });

  it("falls back to a generic message for malformed error bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not json", { status: 500 })),
    );

    await expect(postJson("/api/things", {})).rejects.toMatchObject({
      name: "ApiClientError",
      status: 500,
      message: "Something went wrong. Please try again.",
    });
  });

  it("reports a connection failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(postJson("/api/things", {})).rejects.toMatchObject({
      name: "ApiClientError",
      status: 0,
      message:
        "Couldn’t reach Bridge. Check your connection and try again.",
    });
  });

  it("defaults ApiClientError fields", () => {
    const error = new ApiClientError("boom");

    expect(error.status).toBe(0);
    expect(error.code).toBeUndefined();
    expect(error.fields).toBeUndefined();
  });
});
