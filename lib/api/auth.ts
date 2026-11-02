import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import { verifyAccessToken } from "../auth/jwt";
import type { AuthContext } from "../types/auth.types";
import { ACCESS_TOKEN_COOKIE } from "./auth-response";
import { ApiError } from "./errors";

/**
 * Reads and verifies the access token cookie for protected route handlers.
 *
 * @example
 * const { userId, coupleId } = await requireAuth(request);
 */
export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    throw ApiError.unauthorized();
  }

  const context = await verifyAccessToken(token);

  if (!context) {
    throw ApiError.unauthorized();
  }

  return context;
}

/**
 * Reads and verifies the access token cookie from a Server Component, where
 * there is no `NextRequest` to pass to `requireAuth`.
 *
 * `proxy.ts` refreshes an expired access token before the request reaches the
 * page, so this sees the same credentials as a protected route handler.
 */
export async function getServerAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return verifyAccessToken(token);
}
