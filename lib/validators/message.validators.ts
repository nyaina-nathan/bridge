import { z } from "zod";

import { parseBody, readJsonBody } from "./http";

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, "Message is required"),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export async function parseSendMessageRequest(
  request: Request,
): Promise<SendMessageInput> {
  return parseBody(sendMessageSchema, await readJsonBody(request));
}
