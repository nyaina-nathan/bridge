import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/handler";
import { jsonResponse } from "@/lib/api/json";
import { approvePerspective } from "@/lib/services/perspective.service";

export const POST = withErrorHandling<{ conflictId: string }>(
  async (request, { params }) => {
    const { userId, coupleId } = await requireAuth(request);
    const { conflictId } = await params;
    const result = await approvePerspective(conflictId, coupleId, userId);

    return jsonResponse(result);
  },
);
