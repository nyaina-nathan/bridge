import { SignJWT, jwtVerify } from "jose";

import type { AuthContext } from "../types/auth.types";

const ACCESS_TOKEN_TTL = "15m";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be set and contain at least 32 characters",
    );
  }

  return new TextEncoder().encode(secret);
}

/** Fails fast before doing any database work when the secret is missing. */
export function assertJwtConfigured(): void {
  getJwtSecret();
}

export function signAccessToken(
  userId: string,
  coupleId: string,
): Promise<string> {
  return new SignJWT({ coupleId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getJwtSecret());
}

/**
 * Returns `null` for a missing, expired, malformed or invalidly signed token.
 * Configuration errors still throw so they surface as a `500`.
 */
export async function verifyAccessToken(
  token: string,
): Promise<AuthContext | null> {
  const secret = getJwtSecret();

  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.sub;
    const coupleId = payload.coupleId;

    if (typeof userId !== "string" || typeof coupleId !== "string") {
      return null;
    }

    return { userId, coupleId };
  } catch {
    return null;
  }
}
