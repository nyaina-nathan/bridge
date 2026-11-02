import { NextResponse } from "next/server";

/** JSON response for private API data that must never be cached. */
export function jsonResponse(data: unknown, status = 200): NextResponse {
  const response = NextResponse.json(data, { status });

  response.headers.set("Cache-Control", "no-store");

  return response;
}
