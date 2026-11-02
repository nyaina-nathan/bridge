import { z } from "zod";

import { parseBody, readJsonBody } from "./http";

export const conflictOutcomeSchema = z.enum([
  "resolved",
  "later",
  "unsolvable",
]);

export const createConflictSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
});

export const closeConflictSchema = z.object({
  outcome: conflictOutcomeSchema,
});

const conflictIdSchema = z.string().uuid();

export type CreateConflictInput = z.infer<typeof createConflictSchema>;
export type CloseConflictInput = z.infer<typeof closeConflictSchema>;

/** Malformed path IDs are treated as not found, matching the API's 404 rule. */
export function isValidConflictId(value: string): boolean {
  return conflictIdSchema.safeParse(value).success;
}

export async function parseCreateConflictRequest(
  request: Request,
): Promise<CreateConflictInput> {
  return parseBody(createConflictSchema, await readJsonBody(request));
}

export async function parseCloseConflictRequest(
  request: Request,
): Promise<CloseConflictInput> {
  return parseBody(closeConflictSchema, await readJsonBody(request));
}
