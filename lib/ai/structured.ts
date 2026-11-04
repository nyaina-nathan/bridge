import { jsonrepair } from "jsonrepair";
import type { z } from "zod";

import { ApiError } from "../api/errors";

export function isRateLimitError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    error.statusCode === 429
  );
}

/**
 * Parses a structured model reply. Some providers ignore the JSON schema and
 * wrap the object in a code fence or leave quotes inside strings unescaped, so
 * the text is repaired before validation instead of failing the user's turn.
 */
export function parseJsonReply<T>(
  text: string,
  schema: z.ZodType<T>,
  label: string,
): T {
  const json = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    try {
      parsed = JSON.parse(jsonrepair(json));
    } catch (error) {
      console.error(`[${label}] model reply was not valid JSON`, error);
      throw ApiError.internal(error);
    }
  }

  const result = schema.safeParse(parsed);

  if (!result.success) {
    console.error(
      `[${label}] model reply did not match the schema`,
      result.error.issues,
    );
    throw ApiError.internal(result.error);
  }

  return result.data;
}

/** Maps model failures onto the API error contract without leaking details. */
export function rethrowModelError(error: unknown): never {
  if (error instanceof ApiError) {
    throw error;
  }

  if (isRateLimitError(error)) {
    throw ApiError.rateLimited();
  }

  throw ApiError.internal(error);
}
