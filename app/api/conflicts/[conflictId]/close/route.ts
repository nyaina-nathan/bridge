import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/handler";
import { jsonResponse } from "@/lib/api/json";
import { closeConflict } from "@/lib/services/conflict.service";
import { parseCloseConflictRequest } from "@/lib/validators/conflict.validators";

export const POST = withErrorHandling<{ conflictId: string }>(
  async (request, { params }) => {
    const { coupleId } = await requireAuth(request);
    const { conflictId } = await params;
    const input = await parseCloseConflictRequest(request);
    const conflict = await closeConflict(conflictId, coupleId, input);

    return jsonResponse(conflict);
  },
);
