import { NextResponse } from "next/server";

import type { ApiError } from "./errors";
import type {
  AuthSession,
  AuthTokens,
  RefreshResult,
} from "../types/auth.types";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

const ACCESS_TOKEN_MAX_AGE = 15 * 60;
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60;

type WritableTokens = {
  accessToken: string;
  refreshToken?: string;
};

/**
 * Attaches auth cookies to a response. The refresh cookie is only written when
 * a new refresh token was issued.
 *
 * `Secure` is enabled in production only so `npm run dev` works over HTTP.
 */
function setAuthCookies(
  response: NextResponse,
  tokens: WritableTokens,
): NextResponse {
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  if (tokens.refreshToken) {
    response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/api/auth",
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });
  }

  response.headers.set("Cache-Control", "no-store");

  return response;
}

/** Builds the JSON response and attaches both auth cookies. */
export function authResponse(
  session: AuthSession,
  tokens: AuthTokens,
  status: number,
): NextResponse {
  return setAuthCookies(NextResponse.json(session, { status }), tokens);
}

/** Builds a `200` JSON response for an existing session. */
export function sessionResponse(session: AuthSession): NextResponse {
  const response = NextResponse.json(session);

  response.headers.set("Cache-Control", "no-store");

  return response;
}

/**
 * Builds the `204` response for a refresh. The refresh cookie is only present
 * when the refresh token was rotated.
 */
export function refreshResponse(result: RefreshResult): NextResponse {
  return setAuthCookies(new NextResponse(null, { status: 204 }), result);
}

/** Builds an error response, optionally clearing the auth cookies first. */
export function errorResponse(
  error: ApiError,
  options: { clearCookies?: boolean } = {},
): NextResponse {
  const response = NextResponse.json(error.toJSON(), {
    status: error.status,
    headers: error.headers,
  });

  return options.clearCookies ? clearAuthCookies(response) : response;
}

/** Clears both auth cookies on the response. */
export function clearAuthCookies(response: NextResponse): NextResponse {
  const secure = process.env.NODE_ENV === "production";
  const expired = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    maxAge: 0,
    expires: new Date(0),
  };

  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    ...expired,
    path: "/",
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    ...expired,
    path: "/api/auth",
  });

  response.headers.set("Cache-Control", "no-store");

  return response;
}
