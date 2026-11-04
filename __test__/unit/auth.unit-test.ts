import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import {
  getSession,
  login,
  logout,
  refresh,
  register,
} from "@/lib/services/auth.service";
import { prisma } from "@/lib/db/prisma";
import { resetPrismaMock, type PrismaMock } from "../helpers/prisma-mock";

const { bcryptMocks, signAccessToken, assertJwtConfigured } = vi.hoisted(
  () => ({
    bcryptMocks: {
      hash: vi.fn(),
      compare: vi.fn(),
    },
    signAccessToken: vi.fn(),
    assertJwtConfigured: vi.fn(),
  }),
);

vi.mock("bcrypt", () => ({
  default: bcryptMocks,
  ...bcryptMocks,
}));

vi.mock("@/lib/auth/jwt", () => ({
  signAccessToken,
  assertJwtConfigured,
}));

vi.mock("@/lib/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");

  return { prisma: createPrismaMock() };
});

const db = prisma as unknown as PrismaMock;

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PARTNER_ID = "33333333-3333-4333-8333-333333333333";
const COUPLE_ID = "22222222-2222-4222-8222-222222222222";

const baseUser = {
  id: USER_ID,
  display_name: "Ada",
  email: "ada@example.com",
  password_hash: "stored-hash",
  couples: {
    id: COUPLE_ID,
    invite_code: "ABC123",
    users: [
      { id: USER_ID, display_name: "Ada" },
      { id: PARTNER_ID, display_name: "Grace" },
    ],
  },
};

function sha256(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function passwordViolation(target?: string[]): unknown {
  return {
    code: "P2002",
    meta: target ? { target } : {},
  };
}

beforeEach(() => {
  resetPrismaMock(db);
  signAccessToken.mockResolvedValue("access-token");
});

describe("auth.service register", () => {
  it("rejects an email that is already registered", async () => {
    db.users.findUnique.mockResolvedValue({ id: "existing" });

    await expect(
      register({
        displayName: "Ada",
        email: "ada@example.com",
        password: "supersecret",
        inviteCode: undefined,
      }),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN", status: 409 });

    expect(bcryptMocks.hash).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("creates a couple and stores a hashed refresh token", async () => {
    db.users.findUnique.mockResolvedValue(null);
    db.couples.create.mockImplementation(
      async ({ data }: { data: { invite_code: string } }) => ({
        id: COUPLE_ID,
        invite_code: data.invite_code,
      }),
    );
    db.users.create.mockResolvedValue(baseUser);
    db.refresh_tokens.create.mockResolvedValue({});
    bcryptMocks.hash.mockResolvedValue("hashed-password");

    const result = await register({
      displayName: "Ada",
      email: "ada@example.com",
      password: "supersecret",
      inviteCode: undefined,
    });

    expect(assertJwtConfigured).toHaveBeenCalled();
    expect(bcryptMocks.hash).toHaveBeenCalledWith("supersecret", 12);
    expect(result).toMatchObject({
      session: {
        user: {
          id: USER_ID,
          displayName: "Ada",
          email: "ada@example.com",
        },
        couple: { id: COUPLE_ID, inviteCode: "ABC123" },
      },
      tokens: {
        accessToken: "access-token",
        refreshToken: expect.any(String),
      },
    });

    const inviteCode = db.couples.create.mock.calls[0][0].data.invite_code;
    expect(inviteCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);

    expect(db.users.create).toHaveBeenCalledWith({
      data: {
        couple_id: COUPLE_ID,
        display_name: "Ada",
        email: "ada@example.com",
        password_hash: "hashed-password",
      },
      include: expect.any(Object),
    });
    expect(db.refresh_tokens.create).toHaveBeenCalledWith({
      data: {
        user_id: USER_ID,
        token_hash: sha256(result.tokens.refreshToken),
        expires_at: expect.any(Date),
      },
    });
  });

  it("rejects an unknown invite code", async () => {
    db.users.findUnique.mockResolvedValue(null);
    db.couples.findUnique.mockResolvedValue(null);
    bcryptMocks.hash.mockResolvedValue("hashed-password");

    await expect(
      register({
        displayName: "Ada",
        email: "ada@example.com",
        password: "supersecret",
        inviteCode: "ZZZZZZ",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INVITE_CODE", status: 404 });
  });

  it("rejects a couple that already has two members", async () => {
    db.users.findUnique.mockResolvedValue(null);
    db.couples.findUnique.mockResolvedValue({
      id: COUPLE_ID,
      _count: { users: 2 },
    });
    bcryptMocks.hash.mockResolvedValue("hashed-password");

    await expect(
      register({
        displayName: "Ada",
        email: "ada@example.com",
        password: "supersecret",
        inviteCode: "ABC123",
      }),
    ).rejects.toMatchObject({ code: "COUPLE_FULL", status: 409 });

    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("joins a couple under a row lock", async () => {
    db.users.findUnique.mockResolvedValue(null);
    db.couples.findUnique.mockResolvedValue({
      id: COUPLE_ID,
      _count: { users: 1 },
    });
    db.$queryRaw.mockResolvedValue([{ id: COUPLE_ID }]);
    db.users.count.mockResolvedValue(1);
    db.users.create.mockResolvedValue(baseUser);
    db.refresh_tokens.create.mockResolvedValue({});
    bcryptMocks.hash.mockResolvedValue("hashed-password");

    const result = await register({
      displayName: "Ada",
      email: "ada@example.com",
      password: "supersecret",
      inviteCode: "abc123",
    });

    expect(db.$queryRaw).toHaveBeenCalled();
    expect(db.users.count).toHaveBeenCalledWith({
      where: { couple_id: COUPLE_ID },
    });
    expect(result.session.couple.inviteCode).toBe("ABC123");
  });

  it("re-checks the member limit inside the transaction", async () => {
    db.users.findUnique.mockResolvedValue(null);
    db.couples.findUnique.mockResolvedValue({
      id: COUPLE_ID,
      _count: { users: 1 },
    });
    db.$queryRaw.mockResolvedValue([{ id: COUPLE_ID }]);
    db.users.count.mockResolvedValue(2);
    bcryptMocks.hash.mockResolvedValue("hashed-password");

    await expect(
      register({
        displayName: "Ada",
        email: "ada@example.com",
        password: "supersecret",
        inviteCode: "ABC123",
      }),
    ).rejects.toMatchObject({ code: "COUPLE_FULL" });

    expect(db.users.create).not.toHaveBeenCalled();
  });

  it("treats a couple deleted between reads as an invalid invite", async () => {
    db.users.findUnique.mockResolvedValue(null);
    db.couples.findUnique.mockResolvedValue({
      id: COUPLE_ID,
      _count: { users: 1 },
    });
    db.$queryRaw.mockResolvedValue([]);
    bcryptMocks.hash.mockResolvedValue("hashed-password");

    await expect(
      register({
        displayName: "Ada",
        email: "ada@example.com",
        password: "supersecret",
        inviteCode: "ABC123",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INVITE_CODE" });
  });

  it("maps a unique email violation to EMAIL_TAKEN", async () => {
    db.users.findUnique.mockResolvedValue(null);
    bcryptMocks.hash.mockResolvedValue("hashed-password");
    db.$transaction.mockRejectedValueOnce(passwordViolation(["email"]));

    await expect(
      register({
        displayName: "Ada",
        email: "ada@example.com",
        password: "supersecret",
        inviteCode: undefined,
      }),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });

  it("falls back to an email lookup when the driver omits the target", async () => {
    db.users.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: USER_ID });
    bcryptMocks.hash.mockResolvedValue("hashed-password");
    db.$transaction.mockRejectedValueOnce(passwordViolation());

    await expect(
      register({
        displayName: "Ada",
        email: "ada@example.com",
        password: "supersecret",
        inviteCode: undefined,
      }),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });

  it("rethrows an unrecognised unique violation when joining", async () => {
    db.users.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    db.couples.findUnique.mockResolvedValue({
      id: COUPLE_ID,
      _count: { users: 1 },
    });
    db.$queryRaw.mockResolvedValue([{ id: COUPLE_ID }]);
    db.users.count.mockResolvedValue(1);
    bcryptMocks.hash.mockResolvedValue("hashed-password");

    const original = passwordViolation();

    db.$transaction.mockRejectedValueOnce(original);

    await expect(
      register({
        displayName: "Ada",
        email: "ada@example.com",
        password: "supersecret",
        inviteCode: "ABC123",
      }),
    ).rejects.toBe(original);
  });

  it("retries when a generated invite code collides", async () => {
    db.users.findUnique.mockResolvedValue(null);
    db.couples.create
      .mockRejectedValueOnce(passwordViolation(["invite_code"]))
      .mockRejectedValueOnce(passwordViolation(["invite_code"]))
      .mockResolvedValue({
        id: COUPLE_ID,
        invite_code: "ABC123",
      });
    db.users.create.mockResolvedValue(baseUser);
    db.refresh_tokens.create.mockResolvedValue({});
    bcryptMocks.hash.mockResolvedValue("hashed-password");

    const result = await register({
      displayName: "Ada",
      email: "ada@example.com",
      password: "supersecret",
      inviteCode: undefined,
    });

    expect(result.tokens.accessToken).toBe("access-token");
    expect(db.couples.create).toHaveBeenCalledTimes(3);
  });

  it("gives up after five invite-code collisions", async () => {
    db.users.findUnique.mockResolvedValue(null);
    bcryptMocks.hash.mockResolvedValue("hashed-password");
    db.couples.create.mockRejectedValue(passwordViolation(["invite_code"]));

    await expect(
      register({
        displayName: "Ada",
        email: "ada@example.com",
        password: "supersecret",
        inviteCode: undefined,
      }),
    ).rejects.toThrow("Could not generate a unique invite code");

    expect(db.couples.create).toHaveBeenCalledTimes(5);
  });
});

describe("auth.service login", () => {
  it("hashes even when the email is unknown", async () => {
    db.users.findUnique.mockResolvedValue(null);
    bcryptMocks.hash.mockResolvedValue("dummy-hash");

    await expect(
      login({ email: "nobody@example.com", password: "wrong" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS", status: 401 });

    expect(bcryptMocks.hash).toHaveBeenCalledWith("wrong", 12);
    expect(bcryptMocks.compare).not.toHaveBeenCalled();
  });

  it("rejects a wrong password", async () => {
    db.users.findUnique.mockResolvedValue(baseUser);
    bcryptMocks.compare.mockResolvedValue(false);

    await expect(
      login({ email: "ada@example.com", password: "wrong" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    expect(bcryptMocks.compare).toHaveBeenCalledWith(
      "wrong",
      baseUser.password_hash,
    );
    expect(db.refresh_tokens.create).not.toHaveBeenCalled();
  });

  it("throws when a user has no couple", async () => {
    db.users.findUnique.mockResolvedValue({ ...baseUser, couples: null });
    bcryptMocks.compare.mockResolvedValue(true);

    await expect(
      login({ email: "ada@example.com", password: "supersecret" }),
    ).rejects.toThrow(`User ${USER_ID} does not belong to a couple`);
  });

  it("issues tokens and persists the refresh token", async () => {
    db.users.findUnique.mockResolvedValue(baseUser);
    bcryptMocks.compare.mockResolvedValue(true);
    db.refresh_tokens.create.mockResolvedValue({});

    const result = await login({
      email: "ada@example.com",
      password: "supersecret",
    });

    expect(result.session.user).toEqual({
      id: USER_ID,
      displayName: "Ada",
      email: "ada@example.com",
    });
    expect(result.session.couple.members).toEqual([
      { id: USER_ID, displayName: "Ada" },
      { id: PARTNER_ID, displayName: "Grace" },
    ]);
    expect(result.tokens.accessToken).toBe("access-token");
    expect(db.refresh_tokens.create).toHaveBeenCalledWith({
      data: {
        user_id: USER_ID,
        token_hash: sha256(result.tokens.refreshToken),
        expires_at: expect.any(Date),
      },
    });
  });
});

describe("auth.service refresh", () => {
  const future = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000);
  const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);

  function tokenRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "token-id",
      user_id: USER_ID,
      expires_at: future,
      revoked_at: null,
      users: { couple_id: COUPLE_ID },
      ...overrides,
    };
  }

  it("rejects a missing token", async () => {
    await expect(refresh()).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    });
    expect(db.refresh_tokens.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an unknown token and looks it up by hash", async () => {
    db.refresh_tokens.findUnique.mockResolvedValue(null);

    await expect(refresh("raw-token")).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    });

    expect(db.refresh_tokens.findUnique).toHaveBeenCalledWith({
      where: { token_hash: sha256("raw-token") },
      select: expect.any(Object),
    });
  });

  it("revokes every active token when a revoked token is replayed", async () => {
    db.refresh_tokens.findUnique.mockResolvedValue(
      tokenRow({ revoked_at: new Date() }),
    );
    db.refresh_tokens.updateMany.mockResolvedValue({ count: 2 });

    await expect(refresh("raw-token")).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    });

    expect(db.refresh_tokens.updateMany).toHaveBeenCalledWith({
      where: { user_id: USER_ID, revoked_at: null },
      data: { revoked_at: expect.any(Date) },
    });
  });

  it("rejects an expired token", async () => {
    db.refresh_tokens.findUnique.mockResolvedValue(
      tokenRow({ expires_at: new Date(Date.now() - 1000) }),
    );

    await expect(refresh("raw-token")).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("rejects a user that no longer belongs to a couple", async () => {
    db.refresh_tokens.findUnique.mockResolvedValue(
      tokenRow({ users: { couple_id: null } }),
    );

    await expect(refresh("raw-token")).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("returns only an access token when the refresh token is fresh", async () => {
    db.refresh_tokens.findUnique.mockResolvedValue(tokenRow());

    const result = await refresh("raw-token");

    expect(result).toEqual({ accessToken: "access-token" });
    expect(signAccessToken).toHaveBeenCalledWith(USER_ID, COUPLE_ID);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rotates a refresh token inside the rotation window", async () => {
    db.refresh_tokens.findUnique.mockResolvedValue(
      tokenRow({ expires_at: soon }),
    );
    db.refresh_tokens.updateMany.mockResolvedValue({ count: 1 });
    db.refresh_tokens.create.mockResolvedValue({});

    const result = await refresh("raw-token");

    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(db.refresh_tokens.updateMany).toHaveBeenCalledWith({
      where: { id: "token-id", revoked_at: null },
      data: { revoked_at: expect.any(Date) },
    });
    expect(db.refresh_tokens.create).toHaveBeenCalledWith({
      data: {
        user_id: USER_ID,
        token_hash: sha256(result.refreshToken as string),
        expires_at: expect.any(Date),
      },
    });
  });

  it("rejects when another request already rotated the token", async () => {
    db.refresh_tokens.findUnique.mockResolvedValue(
      tokenRow({ expires_at: soon }),
    );
    db.refresh_tokens.updateMany.mockResolvedValue({ count: 0 });

    await expect(refresh("raw-token")).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    });
    expect(db.refresh_tokens.create).not.toHaveBeenCalled();
  });
});

describe("auth.service getSession", () => {
  it("rejects an unknown user", async () => {
    db.users.findUnique.mockResolvedValue(null);

    await expect(getSession(USER_ID)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects a user without a couple", async () => {
    db.users.findUnique.mockResolvedValue({ ...baseUser, couples: null });

    await expect(getSession(USER_ID)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("maps the current database session", async () => {
    db.users.findUnique.mockResolvedValue(baseUser);

    await expect(getSession(USER_ID)).resolves.toEqual({
      user: {
        id: USER_ID,
        displayName: "Ada",
        email: "ada@example.com",
      },
      couple: {
        id: COUPLE_ID,
        inviteCode: "ABC123",
        members: [
          { id: USER_ID, displayName: "Ada" },
          { id: PARTNER_ID, displayName: "Grace" },
        ],
      },
    });
  });
});

describe("auth.service logout", () => {
  it("is a no-op without a refresh token", async () => {
    await logout(USER_ID);

    expect(db.refresh_tokens.updateMany).not.toHaveBeenCalled();
  });

  it("revokes only the caller's matching token", async () => {
    db.refresh_tokens.updateMany.mockResolvedValue({ count: 1 });

    await logout(USER_ID, "raw-token");

    expect(db.refresh_tokens.updateMany).toHaveBeenCalledWith({
      where: {
        user_id: USER_ID,
        token_hash: sha256("raw-token"),
        revoked_at: null,
      },
      data: { revoked_at: expect.any(Date) },
    });
  });

  it("stays idempotent for an already revoked token", async () => {
    db.refresh_tokens.updateMany.mockResolvedValue({ count: 0 });

    await expect(logout(USER_ID, "raw-token")).resolves.toBeUndefined();
  });
});

describe("auth.service error type", () => {
  it("throws ApiError instances", async () => {
    db.users.findUnique.mockResolvedValue(null);
    bcryptMocks.hash.mockResolvedValue("hashed-password");
    db.$transaction.mockRejectedValueOnce(passwordViolation(["email"]));

    await expect(
      register({
        displayName: "Ada",
        email: "ada@example.com",
        password: "supersecret",
        inviteCode: undefined,
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
