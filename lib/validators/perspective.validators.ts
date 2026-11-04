import { z } from "zod";

import { parseBody, readJsonBody } from "./http";

export const updatePerspectiveSchema = z.object({
  summary: z.string().trim().min(1, "Summary is required"),
});

export type UpdatePerspectiveInput = z.infer<typeof updatePerspectiveSchema>;

export async function parseUpdatePerspectiveRequest(
  request: Request,
): Promise<UpdatePerspectiveInput> {
  return parseBody(updatePerspectiveSchema, await readJsonBody(request));
}
