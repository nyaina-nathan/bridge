import {
  errorResponse,
  refreshResponse,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/api/auth-response";
import { isApiError } from "@/lib/api/errors";
import { withErrorHandling } from "@/lib/api/handler";
import { refresh } from "@/lib/services/auth.service";

export const POST = withErrorHandling(async (request) => {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  try {
    const tokens = await refresh(refreshToken);

    return refreshResponse(tokens);
  } catch (error) {
    if (isApiError(error) && error.code === "INVALID_REFRESH_TOKEN") {
      return errorResponse(error, { clearCookies: true });
    }

    throw error;
  }
});
