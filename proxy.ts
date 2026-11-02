import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/api/auth-response";
import { verifyAccessToken } from "@/lib/auth/jwt";

const PUBLIC_PAGES = new Set(["/", "/login", "/register"]);
const AUTH_PAGES = new Set(["/login", "/register"]);

/**
 * These endpoints must never trigger a refresh themselves. `refresh` would
 * recurse, while `login` and `register` are the requests that establish a
 * session in the first place.
 */
const SKIP_REFRESH_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
]);

type SessionResolution = {
  authenticated: boolean;
  setCookies: string[];
  requestHeaders: Headers;
};

type ParsedSetCookie = {
  name: string;
  value: string;
  expired: boolean;
};

function parseSetCookie(header: string): ParsedSetCookie | null {
  const [pair, ...attributes] = header.split(";");
  const separator = pair.indexOf("=");

  if (separator === -1) {
    return null;
  }

  const name = pair.slice(0, separator).trim();
  const value = pair.slice(separator + 1).trim();

  if (!name) {
    return null;
  }

  const expired = attributes.some((attribute) => {
    const [rawKey, rawValue] = attribute.trim().split("=");
    return (
      rawKey.toLowerCase() === "max-age" &&
      rawValue !== undefined &&
      Number(rawValue) <= 0
    );
  });

  return { name, value, expired };
}

/** Applies refreshed cookies to the request's `Cookie` header. */
function mergeCookies(
  cookieHeader: string | null,
  setCookies: string[],
): string {
  const cookies = new Map<string, string>();

  for (const part of cookieHeader?.split(";") ?? []) {
    const item = part.trim();

    if (!item) {
      continue;
    }

    const separator = item.indexOf("=");

    if (separator === -1) {
      continue;
    }

    cookies.set(item.slice(0, separator), item.slice(separator + 1));
  }

  for (const header of setCookies) {
    const cookie = parseSetCookie(header);

    if (!cookie) {
      continue;
    }

    if (cookie.expired) {
      cookies.delete(cookie.name);
    } else {
      cookies.set(cookie.name, cookie.value);
    }
  }

  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

function withSetCookies<T extends NextResponse>(
  response: T,
  setCookies: string[],
): T {
  for (const cookie of setCookies) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}

async function attemptRefresh(request: NextRequest): Promise<string[]> {
  if (!request.cookies.get(REFRESH_TOKEN_COOKIE)?.value) {
    return [];
  }

  try {
    const response = await fetch(new URL("/api/auth/refresh", request.url), {
      method: "POST",
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });

    return response.headers.getSetCookie();
  } catch {
    // A failed refresh is treated exactly like no session. API routes still
    // return 401 through `requireAuth`, and pages redirect to `/login`.
    return [];
  }
}

async function resolveSession(
  request: NextRequest,
): Promise<SessionResolution> {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (accessToken) {
    const context = await verifyAccessToken(accessToken);

    if (context) {
      return {
        authenticated: true,
        setCookies: [],
        requestHeaders: request.headers,
      };
    }
  }

  const setCookies = await attemptRefresh(request);
  const refreshedAccessToken = setCookies.some((header) => {
    const cookie = parseSetCookie(header);
    return (
      cookie?.name === ACCESS_TOKEN_COOKIE &&
      !cookie.expired &&
      cookie.value !== ""
    );
  });

  if (!refreshedAccessToken) {
    return {
      authenticated: false,
      setCookies,
      requestHeaders: request.headers,
    };
  }

  const requestHeaders = new Headers(request.headers);
  const cookieHeader = mergeCookies(
    request.headers.get("cookie"),
    setCookies,
  );

  if (cookieHeader) {
    requestHeaders.set("cookie", cookieHeader);
  } else {
    requestHeaders.delete("cookie");
  }

  return {
    authenticated: true,
    setCookies,
    requestHeaders,
  };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (SKIP_REFRESH_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const { authenticated, setCookies, requestHeaders } =
    await resolveSession(request);

  const proceed = () => {
    if (setCookies.length === 0) {
      return NextResponse.next();
    }

    return withSetCookies(
      NextResponse.next({ request: { headers: requestHeaders } }),
      setCookies,
    );
  };

  // APIs are never redirected: a failed refresh simply lets `requireAuth`
  // return the usual 401.
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return proceed();
  }

  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.headers.set("Cache-Control", "no-store");
    return withSetCookies(response, setCookies);
  };

  if (!authenticated && !PUBLIC_PAGES.has(pathname)) {
    return redirect("/login");
  }

  if (authenticated && AUTH_PAGES.has(pathname)) {
    return redirect("/dashboard");
  }

  return proceed();
}

export const config = {
  matcher: [
    "/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|txt|xml|webmanifest|woff|woff2|ttf|otf)$).*)",
  ],
};
