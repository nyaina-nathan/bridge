import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/handler";
import { jsonResponse } from "@/lib/api/json";
import {
  getPerspective,
  updatePerspective,
} from "@/lib/services/perspective.service";
import { parseUpdatePerspectiveRequest } from "@/lib/validators/perspective.validators";

export const GET = withErrorHandling<{ conflictId: string }>(
  async (request, { params }) => {
    const { userId, coupleId } = await requireAuth(request);
    const { conflictId } = await params;
    const perspective = await getPerspective(conflictId, coupleId, userId);

    return jsonResponse(perspective);
  },
);

export const PUT = withErrorHandling<{ conflictId: string }>(
  async (request, { params }) => {
    const { userId, coupleId } = await requireAuth(request);
    const { conflictId } = await params;
    const input = await parseUpdatePerspectiveRequest(request);
    const perspective = await updatePerspective(
      conflictId,
      coupleId,
      userId,
      input,
    );

    return jsonResponse(perspective);
  },
);
