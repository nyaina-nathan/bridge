import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import {
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/api/auth-response";
import { withErrorHandling } from "@/lib/api/handler";
import { logout } from "@/lib/services/auth.service";

export const POST = withErrorHandling(async (request) => {
  const { userId } = await requireAuth(request);
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  await logout(userId, refreshToken);

  return clearAuthCookies(new NextResponse(null, { status: 204 }));
});
