import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/handler";
import { jsonResponse } from "@/lib/api/json";
import { shareFeelings } from "@/lib/services/perspective.service";
import { parseShareFeelingsRequest } from "@/lib/validators/perspective.validators";

export const POST = withErrorHandling<{ conflictId: string }>(
  async (request, { params }) => {
    const { userId, coupleId } = await requireAuth(request);
    const { conflictId } = await params;
    const input = await parseShareFeelingsRequest(request);
    const result = await shareFeelings(conflictId, coupleId, userId, input);

    return jsonResponse(result);
  },
);
