import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/handler";
import { jsonResponse } from "@/lib/api/json";
import { listMessages, sendMessage } from "@/lib/services/message.service";
import { parseSendMessageRequest } from "@/lib/validators/message.validators";

export const GET = withErrorHandling<{ conflictId: string }>(
  async (request, { params }) => {
    const { userId, coupleId } = await requireAuth(request);
    const { conflictId } = await params;
    const messages = await listMessages(conflictId, coupleId, userId);

    return jsonResponse(messages);
  },
);

export const POST = withErrorHandling<{ conflictId: string }>(
  async (request, { params }) => {
    const { userId, coupleId } = await requireAuth(request);
    const { conflictId } = await params;
    const input = await parseSendMessageRequest(request);
    const result = await sendMessage(conflictId, coupleId, userId, input);

    return jsonResponse(result, 201);
  },
);
