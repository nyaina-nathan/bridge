import { z } from "zod";

import { parseBody, readJsonBody } from "./http";

export const updatePerspectiveSchema = z.object({
  summary: z.string().trim().min(1, "Summary is required"),
});

export const shareFeelingsSchema = z.object({
  feelings: z.string().trim().min(1, "Feelings are required"),
});

export type UpdatePerspectiveInput = z.infer<typeof updatePerspectiveSchema>;
export type ShareFeelingsInput = z.infer<typeof shareFeelingsSchema>;

export async function parseUpdatePerspectiveRequest(
  request: Request,
): Promise<UpdatePerspectiveInput> {
  return parseBody(updatePerspectiveSchema, await readJsonBody(request));
}

export async function parseShareFeelingsRequest(
  request: Request,
): Promise<ShareFeelingsInput> {
  return parseBody(shareFeelingsSchema, await readJsonBody(request));
}
