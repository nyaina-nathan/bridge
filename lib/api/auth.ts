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
