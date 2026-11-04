import { createHash } from "node:crypto";

import { NextRequest } from "next/server";

export type CookieJar = Record<string, string>;

type RequestOptions = {
  body?: unknown;
  rawBody?: string;
  jar?: CookieJar;
  headers?: Record<string, string>;
};

export function cookieHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

/** Builds a `NextRequest` carrying the current cookie jar. */
export function buildRequest(
  method: string,
  path: string,
  options: RequestOptions = {},
): NextRequest {
  const headers = new Headers(options.headers);
  const cookie = cookieHeader(options.jar ?? {});

  if (cookie) {
    headers.set("cookie", cookie);
  }

  const body =
    options.rawBody ??
    (options.body === undefined ? undefined : JSON.stringify(options.body));

  if (body !== undefined) {
    headers.set("content-type", "application/json");
  }

  return new NextRequest(new URL(path, "http://localhost"), {
    method,
    headers,
    body,
  });
}

/** Copies `Set-Cookie` values into the jar, removing expired cookies. */
export function captureCookies(response: Response, jar: CookieJar): void {
  for (const cookie of response.headers.getSetCookie()) {
    const [pair, ...attributes] = cookie.split(";");
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1);
    const expired = attributes.some((attribute) =>
      /^\s*max-age=0\s*$/i.test(attribute),
    );

    if (expired) {
      delete jar[name];
    } else {
      jar[name] = value;
    }
  }
}

/**
 * Calls an App Router handler directly, supplying the async `params` object
 * Next.js would normally provide.
 */
export async function invoke<TParams extends Record<string, string>>(
  handler: (
    request: NextRequest,
    context: { params: Promise<TParams> },
  ) => Response | Promise<Response>,
  request: NextRequest,
  params: TParams,
): Promise<Response> {
  return handler(request, { params: Promise.resolve(params) });
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
