import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/handler";
import { jsonResponse } from "@/lib/api/json";
import { getPartnerPerspective } from "@/lib/services/perspective.service";

export const GET = withErrorHandling<{ conflictId: string }>(
  async (request, { params }) => {
    const { userId, coupleId } = await requireAuth(request);
    const { conflictId } = await params;
    const result = await getPartnerPerspective(conflictId, coupleId, userId);

    return jsonResponse(result);
  },
);
