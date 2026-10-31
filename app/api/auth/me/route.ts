import { requireAuth } from "@/lib/api/auth";
import { sessionResponse } from "@/lib/api/auth-response";
import { withErrorHandling } from "@/lib/api/handler";
import { getSession } from "@/lib/services/auth.service";

export const GET = withErrorHandling(async (request) => {
  const { userId } = await requireAuth(request);
  const session = await getSession(userId);

  return sessionResponse(session);
});
