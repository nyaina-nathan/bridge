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

/** Structural subset of the OpenRouter response we need to explain failures. */
type ModelResponse = {
  status?: string;
  outputText?: string | null;
  incompleteDetails?: { reason?: string | null } | null;
  error?: unknown;
  output?: Array<{
    type?: string;
    content?: string | Array<{ type?: string; text?: string }> | null;
  }> | null;
  usage?: unknown;
};

type ModelResultLike = {
  getResponse: () => Promise<unknown>;
};

function extractModelText(response: ModelResponse): string {
  if (typeof response.outputText === "string" && response.outputText.trim()) {
    return response.outputText;
  }

  const parts: string[] = [];

  for (const item of response.output ?? []) {
    if (item.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }

    for (const part of item.content) {
      if (
        (part.type === "output_text" || part.type === "text") &&
        typeof part.text === "string"
      ) {
        parts.push(part.text);
      }
    }
  }

  return parts.join("");
}

/**
 * Reads the text from a structured model reply.
 *
 * `getText()` returns an empty string when the model exhausts the output budget
 * on reasoning and never emits a message. Reading the full response lets us
 * fail with the actual finish reason instead of a misleading JSON error.
 */
export async function readModelText(
  result: ModelResultLike,
  label: string,
): Promise<string> {
  const response = (await result.getResponse()) as ModelResponse;
  const text = extractModelText(response);

  if (text.trim()) {
    return text;
  }

  const reason = response.incompleteDetails?.reason;
  const outputTypes = (response.output ?? []).map(
    (item) => item.type ?? "unknown",
  );

  console.error(`[${label}] model returned no text`, {
    status: response.status,
    reason: reason ?? null,
    outputTypes,
    usage: response.usage,
    error: response.error,
  });

  throw ApiError.internal(
    new Error(
      reason
        ? `Model stopped before replying (${reason})`
        : "Model returned an empty reply",
    ),
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

  if (!json) {
    const error = new Error(`${label} model reply was empty`);
    console.error(`[${label}] model reply was empty`, error);
    throw ApiError.internal(error);
  }

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
