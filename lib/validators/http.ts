import { z } from "zod";

import { ApiError } from "../api/errors";

/** Turns Zod issues into the `fields` object used by `VALIDATION_ERROR`. */
export function formatIssues(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "body";
    fields[field] ??= issue.message;
  }

  return fields;
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw ApiError.validation({ body: "Request body must be valid JSON" });
  }
}

export function parseBody<T extends z.ZodType>(
  schema: T,
  body: unknown,
): z.infer<T> {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw ApiError.validation(formatIssues(result.error));
  }

  return result.data;
}
