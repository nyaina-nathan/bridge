import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/types/auth.types";
import { startTestDatabase, type TestDatabase } from "../helpers/integration-db";
import {
  buildRequest,
  captureCookies,
  invoke,
  readJson,
  sha256,
  type CookieJar,
} from "../helpers/integration-harness";

type AuthRoutes = {
  register: typeof import("@/app/api/auth/register/route");
  login: typeof import("@/app/api/auth/login/route");
  me: typeof import("@/app/api/auth/me/route");
  refresh: typeof import("@/app/api/auth/refresh/route");
  logout: typeof import("@/app/api/auth/logout/route");
};

type Prisma = typeof import("@/lib/db/prisma").prisma;

let db: TestDatabase;
let prisma: Prisma;
let routes: AuthRoutes;

const JWT_SECRET = "integration-test-secret-value-32chars";

function email(label = "user"): string {
  return `${label}-${randomUUID()}@example.com`;
}

async function registerUser(
  options: {
    displayName?: string;
    email?: string;
    password?: string;
    inviteCode?: string;
    jar?: CookieJar;
  } = {},
) {
  const jar = options.jar ?? {};
  const response = await invoke(
    routes.register.POST,
    buildRequest("POST", "/api/auth/register", {
      body: {
        displayName: options.displayName ?? "Ada",
        email: options.email ?? email(),
        password: options.password ?? "supersecret",
        inviteCode: options.inviteCode,
      },
      jar,
    }),
    {},
  );
  const session = await readJson<AuthSession>(response);

  captureCookies(response, jar);

  return { response, jar, session };
}

function cookieValue(jar: CookieJar, name: string): string {
  const value = jar[name];

  if (!value) {
    throw new Error(`Missing cookie ${name}`);
  }

  return value;
}

beforeAll(async () => {
  db = await startTestDatabase();
  process.env.DATABASE_URL = db.connectionUri;
  process.env.JWT_SECRET = JWT_SECRET;

  vi.resetModules();

  prisma = (await import("@/lib/db/prisma")).prisma;
  routes = {
    register: await import("@/app/api/auth/register/route"),
    login: await import("@/app/api/auth/login/route"),
    me: await import("@/app/api/auth/me/route"),
    refresh: await import("@/app/api/auth/refresh/route"),
    logout: await import("@/app/api/auth/logout/route"),
  };
});

beforeEach(async () => {
  await db.reset();
});

afterAll(async () => {
  await prisma?.$disconnect();
  await db?.stop();
});

describe("POST /api/auth/register", () => {
  it("creates a user and couple with auth cookies", async () => {
    const { response, jar, session } = await registerUser({
      displayName: "Ada",
      email: email("ada"),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(session.user).toMatchObject({
      displayName: "Ada",
      email: expect.stringContaining("@example.com"),
    });
    expect(session.couple.members).toEqual([
      { id: session.user.id, displayName: "Ada" },
    ]);
    expect(session.couple.inviteCode).toMatch(
      /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/,
    );

    const setCookies = response.headers.getSetCookie();
    expect(setCookies.some((cookie) => cookie.startsWith("access_token="))).toBe(
      true,
    );
    expect(
      setCookies.some((cookie) => cookie.startsWith("refresh_token=")),
    ).toBe(true);
    expect(jar.access_token).toBeDefined();
    expect(jar.refresh_token).toBeDefined();

    const serialised = JSON.stringify(session);
    expect(serialised).not.toContain("password");
    expect(serialised).not.toContain("token_hash");

    const users = await prisma.users.findMany();
    expect(users).toHaveLength(1);
    expect(users[0].password_hash).not.toBe("supersecret");
    expect(await prisma.couples.count()).toBe(1);
  });

  it("rejects a duplicate email", async () => {
    const duplicated = email("duplicate");
    await registerUser({ email: duplicated });

    const response = await invoke(
      routes.register.POST,
      buildRequest("POST", "/api/auth/register", {
        body: {
          displayName: "Other",
          email: duplicated,
          password: "supersecret",
        },
      }),
      {},
    );

    expect(response.status).toBe(409);
    await expect(readJson(response)).resolves.toMatchObject({
      error: { code: "EMAIL_TAKEN" },
    });
  });

  it("returns field errors for an invalid body", async () => {
    const response = await invoke(
      routes.register.POST,
      buildRequest("POST", "/api/auth/register", {
        body: { displayName: "", email: "nope", password: "short" },
      }),
      {},
    );

    expect(response.status).toBe(400);
    const body = await readJson<{
      error: { code: string; fields: Record<string, string> };
    }>(response);

    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields).toMatchObject({
      displayName: "Display name is required",
      email: "Must be a valid email",
      password: "Password must be at least 8 characters",
    });
  });

  it("returns a validation error for malformed JSON", async () => {
    const response = await invoke(
      routes.register.POST,
      buildRequest("POST", "/api/auth/register", { rawBody: "{ nope" }),
      {},
    );

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fields: { body: "Request body must be valid JSON" },
      },
    });
  });

  it("joins an existing couple with an invite code", async () => {
    const first = await registerUser({ displayName: "Ada" });
    const second = await registerUser({
      displayName: "Grace",
      inviteCode: first.session.couple.inviteCode,
    });

    expect(second.response.status).toBe(201);
    expect(second.session.couple.id).toBe(first.session.couple.id);
    expect(second.session.couple.members).toHaveLength(2);

    const me = await invoke(
      routes.me.GET,
      buildRequest("GET", "/api/auth/me", { jar: first.jar }),
      {},
    );
    const body = await readJson<AuthSession>(me);

    expect(body.couple.members).toHaveLength(2);
  });

  it("rejects an invalid invite code", async () => {
    const response = await invoke(
      routes.register.POST,
      buildRequest("POST", "/api/auth/register", {
        body: {
          displayName: "Ada",
          email: email(),
          password: "supersecret",
          inviteCode: "ZZZZZZ",
        },
      }),
      {},
    );

    expect(response.status).toBe(404);
    await expect(readJson(response)).resolves.toMatchObject({
      error: { code: "INVALID_INVITE_CODE" },
    });
  });

  it("rejects a third member for the same couple", async () => {
    const first = await registerUser();
    const second = await registerUser({
      inviteCode: first.session.couple.inviteCode,
    });

    expect(second.response.status).toBe(201);

    const third = await invoke(
      routes.register.POST,
      buildRequest("POST", "/api/auth/register", {
        body: {
          displayName: "Third",
          email: email("third"),
          password: "supersecret",
          inviteCode: first.session.couple.inviteCode,
        },
      }),
      {},
    );

    expect(third.status).toBe(409);
    await expect(readJson(third)).resolves.toMatchObject({
      error: { code: "COUPLE_FULL" },
    });
    expect(
      await prisma.users.count({ where: { couple_id: first.session.couple.id } }),
    ).toBe(2);
  });
});

describe("POST /api/auth/login", () => {
  it("returns a session and fresh cookies", async () => {
    const { session } = await registerUser({ email: email("login") });
    const jar: CookieJar = {};

    const response = await invoke(
      routes.login.POST,
      buildRequest("POST", "/api/auth/login", {
        body: { email: session.user.email, password: "supersecret" },
        jar,
      }),
      {},
    );
    const body = await readJson<AuthSession>(response);

    captureCookies(response, jar);

    expect(response.status).toBe(200);
    expect(body.user.email).toBe(session.user.email);
    expect(jar.access_token).toBeDefined();
    expect(jar.refresh_token).toBeDefined();
  });

  it("rejects a wrong password", async () => {
    const { session } = await registerUser({ email: email("wrong-pass") });

    const response = await invoke(
      routes.login.POST,
      buildRequest("POST", "/api/auth/login", {
        body: { email: session.user.email, password: "incorrect" },
      }),
      {},
    );

    expect(response.status).toBe(401);
    await expect(readJson(response)).resolves.toMatchObject({
      error: { code: "INVALID_CREDENTIALS" },
    });
  });

  it("rejects an unknown email", async () => {
    const response = await invoke(
      routes.login.POST,
      buildRequest("POST", "/api/auth/login", {
        body: { email: email("unknown"), password: "supersecret" },
      }),
      {},
    );

    expect(response.status).toBe(401);
    await expect(readJson(response)).resolves.toMatchObject({
      error: { code: "INVALID_CREDENTIALS" },
    });
  });
});

describe("GET /api/auth/me", () => {
  it("returns the session for a valid access cookie", async () => {
    const { jar, session } = await registerUser();

    const response = await invoke(
      routes.me.GET,
      buildRequest("GET", "/api/auth/me", { jar }),
      {},
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(readJson(response)).resolves.toEqual(session);
  });

  it("rejects a missing access cookie", async () => {
    const response = await invoke(
      routes.me.GET,
      buildRequest("GET", "/api/auth/me"),
      {},
    );

    expect(response.status).toBe(401);
    await expect(readJson(response)).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("rejects a tampered access cookie", async () => {
    const response = await invoke(
      routes.me.GET,
      buildRequest("GET", "/api/auth/me", {
        jar: { access_token: "not-a-jwt" },
      }),
      {},
    );

    expect(response.status).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  it("issues a new access token without rotating a fresh refresh token", async () => {
    const { jar } = await registerUser();
    const refreshToken = cookieValue(jar, "refresh_token");

    const response = await invoke(
      routes.refresh.POST,
      buildRequest("POST", "/api/auth/refresh", { jar }),
      {},
    );

    expect(response.status).toBe(204);
    const setCookies = response.headers.getSetCookie();

    expect(setCookies.some((cookie) => cookie.startsWith("access_token="))).toBe(
      true,
    );
    expect(
      setCookies.some((cookie) => cookie.startsWith("refresh_token=")),
    ).toBe(false);

    const [row] = await db.query<{ revoked_at: Date | null }>(
      "SELECT revoked_at FROM refresh_tokens WHERE token_hash = $1",
      [sha256(refreshToken)],
    );
    expect(row.revoked_at).toBeNull();
  });

  it("rotates a refresh token inside the rotation window", async () => {
    const { jar } = await registerUser();
    const oldRefresh = cookieValue(jar, "refresh_token");

    await db.query(
      "UPDATE refresh_tokens SET expires_at = now() + interval '2 hours' WHERE token_hash = $1",
      [sha256(oldRefresh)],
    );

    const response = await invoke(
      routes.refresh.POST,
      buildRequest("POST", "/api/auth/refresh", { jar }),
      {},
    );

    expect(response.status).toBe(204);
    expect(
      response.headers
        .getSetCookie()
        .some((cookie) => cookie.startsWith("refresh_token=")),
    ).toBe(true);

    captureCookies(response, jar);

    const nextRefresh = cookieValue(jar, "refresh_token");
    expect(nextRefresh).not.toBe(oldRefresh);

    const [oldRow] = await db.query<{ revoked_at: Date | null }>(
      "SELECT revoked_at FROM refresh_tokens WHERE token_hash = $1",
      [sha256(oldRefresh)],
    );
    const [nextRow] = await db.query<{ revoked_at: Date | null }>(
      "SELECT revoked_at FROM refresh_tokens WHERE token_hash = $1",
      [sha256(nextRefresh)],
    );

    expect(oldRow.revoked_at).not.toBeNull();
    expect(nextRow.revoked_at).toBeNull();
  });

  it("revokes every token when a rotated token is replayed", async () => {
    const { jar, session } = await registerUser();
    const oldRefresh = cookieValue(jar, "refresh_token");

    await db.query(
      "UPDATE refresh_tokens SET expires_at = now() + interval '2 hours' WHERE token_hash = $1",
      [sha256(oldRefresh)],
    );

    const rotated = await invoke(
      routes.refresh.POST,
      buildRequest("POST", "/api/auth/refresh", { jar }),
      {},
    );
    captureCookies(rotated, jar);

    const replay = await invoke(
      routes.refresh.POST,
      buildRequest("POST", "/api/auth/refresh", {
        jar: { refresh_token: oldRefresh },
      }),
      {},
    );

    expect(replay.status).toBe(401);
    await expect(readJson(replay)).resolves.toMatchObject({
      error: { code: "INVALID_REFRESH_TOKEN" },
    });
    expect(
      replay.headers
        .getSetCookie()
        .some((cookie) => cookie.startsWith("access_token=;")),
    ).toBe(true);

    const rows = await db.query<{ revoked_at: Date | null }>(
      "SELECT revoked_at FROM refresh_tokens WHERE user_id = $1",
      [session.user.id],
    );

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.revoked_at !== null)).toBe(true);
  });

  it("rejects a missing refresh cookie", async () => {
    const response = await invoke(
      routes.refresh.POST,
      buildRequest("POST", "/api/auth/refresh"),
      {},
    );

    expect(response.status).toBe(401);
    await expect(readJson(response)).resolves.toMatchObject({
      error: { code: "INVALID_REFRESH_TOKEN" },
    });
  });
});

describe("POST /api/auth/logout", () => {
  it("clears cookies and revokes the refresh token", async () => {
    const { jar, session } = await registerUser();
    const refreshToken = cookieValue(jar, "refresh_token");

    const response = await invoke(
      routes.logout.POST,
      buildRequest("POST", "/api/auth/logout", { jar }),
      {},
    );

    expect(response.status).toBe(204);
    const setCookies = response.headers.getSetCookie();

    expect(
      setCookies.some(
        (cookie) => cookie.startsWith("access_token=;") && /max-age=0/i.test(cookie),
      ),
    ).toBe(true);
    expect(
      setCookies.some(
        (cookie) =>
          cookie.startsWith("refresh_token=;") && /max-age=0/i.test(cookie),
      ),
    ).toBe(true);

    const [row] = await db.query<{ revoked_at: Date | null }>(
      "SELECT revoked_at FROM refresh_tokens WHERE token_hash = $1",
      [sha256(refreshToken)],
    );
    expect(row.revoked_at).not.toBeNull();

    const refresh = await invoke(
      routes.refresh.POST,
      buildRequest("POST", "/api/auth/refresh", {
        jar: { refresh_token: refreshToken },
      }),
      {},
    );
    expect(refresh.status).toBe(401);

    expect(session.user.id).toBeDefined();
  });

  it("requires authentication", async () => {
    const response = await invoke(
      routes.logout.POST,
      buildRequest("POST", "/api/auth/logout"),
      {},
    );

    expect(response.status).toBe(401);
  });
});
