import { SignJWT, decodeJwt, jwtVerify } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertJwtConfigured,
  signAccessToken,
  verifyAccessToken,
} from "@/lib/auth/jwt";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const COUPLE_ID = "22222222-2222-4222-8222-222222222222";
const SECRET = "a".repeat(32);

function secretBytes(secret = SECRET): Uint8Array {
  return new TextEncoder().encode(secret);
}

beforeEach(() => {
  vi.stubEnv("JWT_SECRET", SECRET);
});

describe("lib/auth/jwt configuration", () => {
  it("accepts a secret of at least 32 characters", () => {
    expect(() => assertJwtConfigured()).not.toThrow();
  });

  it("rejects a missing secret", () => {
    vi.stubEnv("JWT_SECRET", "");

    expect(() => assertJwtConfigured()).toThrow(
      "JWT_SECRET must be set and contain at least 32 characters",
    );
    expect(() => assertJwtConfigured()).toThrow();
  });

  it("rejects a short secret", () => {
    vi.stubEnv("JWT_SECRET", "short");

    expect(() => assertJwtConfigured()).toThrow(
      "JWT_SECRET must be set and contain at least 32 characters",
    );
  });
});

describe("lib/auth/jwt signAccessToken", () => {
  it("signs an access token with the expected claims and TTL", async () => {
    const token = await signAccessToken(USER_ID, COUPLE_ID);

    const payload = decodeJwt(token);

    expect(payload.sub).toBe(USER_ID);
    expect(payload.coupleId).toBe(COUPLE_ID);
    expect(payload.exp).toBeDefined();
    expect(payload.iat).toBeDefined();
    expect((payload.exp as number) - (payload.iat as number)).toBe(15 * 60);

    const verified = await jwtVerify(token, secretBytes());
    expect(verified.payload.sub).toBe(USER_ID);
  });
});

describe("lib/auth/jwt verifyAccessToken", () => {
  it("returns the auth context for a valid token", async () => {
    const token = await signAccessToken(USER_ID, COUPLE_ID);

    await expect(verifyAccessToken(token)).resolves.toEqual({
      userId: USER_ID,
      coupleId: COUPLE_ID,
    });
  });

  it("returns null for a malformed token", async () => {
    await expect(verifyAccessToken("not-a-jwt")).resolves.toBeNull();
  });

  it("returns null for a token signed with another secret", async () => {
    const token = await new SignJWT({ coupleId: COUPLE_ID })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(USER_ID)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(secretBytes("b".repeat(32)));

    await expect(verifyAccessToken(token)).resolves.toBeNull();
  });

  it("returns null for an expired token", async () => {
    const token = await new SignJWT({ coupleId: COUPLE_ID })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(USER_ID)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secretBytes());

    await expect(verifyAccessToken(token)).resolves.toBeNull();
  });

  it("returns null when the subject is missing", async () => {
    const token = await new SignJWT({ coupleId: COUPLE_ID })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(secretBytes());

    await expect(verifyAccessToken(token)).resolves.toBeNull();
  });

  it("returns null when coupleId is not a string", async () => {
    const token = await new SignJWT({ coupleId: 42 })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(USER_ID)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(secretBytes());

    await expect(verifyAccessToken(token)).resolves.toBeNull();
  });

  it("still throws configuration errors", async () => {
    vi.stubEnv("JWT_SECRET", "");

    await expect(verifyAccessToken("anything")).rejects.toThrow(
      "JWT_SECRET must be set and contain at least 32 characters",
    );
  });
});
