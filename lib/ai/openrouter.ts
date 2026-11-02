import { OpenRouter } from "@openrouter/sdk";

import { ApiError } from "../api/errors";

const DEFAULT_MESSAGE_MODEL = "openai/gpt-4.1-mini";

let client: OpenRouter | null = null;

/**
 * Returns the shared OpenRouter client. The key is only read on the first call
 * so a missing key surfaces as a logged 500 instead of a module-load crash.
 */
export function getOpenRouterClient(): OpenRouter {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw ApiError.internal(new Error("OPENROUTER_API_KEY is not configured"));
  }

  client ??= new OpenRouter({ apiKey });

  return client;
}

/** Model used for the private mediator chat, configurable per environment. */
export function getMessageModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MESSAGE_MODEL;
}
