import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/handler";
import { jsonResponse } from "@/lib/api/json";
import { listMessages } from "@/lib/services/message.service";

export const GET = withErrorHandling<{ conflictId: string }>(
  async (request, { params }) => {
    const { userId, coupleId } = await requireAuth(request);
    const { conflictId } = await params;
    const messages = await listMessages(conflictId, coupleId, userId);

    return jsonResponse(messages);
  },
);
