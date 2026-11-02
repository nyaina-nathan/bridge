import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/handler";
import { jsonResponse } from "@/lib/api/json";
import { getConflictDetail } from "@/lib/services/conflict.service";

export const GET = withErrorHandling<{ conflictId: string }>(
  async (request, { params }) => {
    const { userId, coupleId } = await requireAuth(request);
    const { conflictId } = await params;
    const conflict = await getConflictDetail(conflictId, coupleId, userId);

    return jsonResponse(conflict);
  },
);
