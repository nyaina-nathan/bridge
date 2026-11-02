import { jsonrepair } from "jsonrepair";
import { z } from "zod";

import { ApiError } from "../api/errors";
import type { MessageRole } from "../types/message.types";
import { buildMessageSystemPrompt } from "../prompts/message.prompts";
import { getMessageModel, getOpenRouterClient } from "./openrouter";

export const mediatorReplySchema = z.object({
  reply: z.string().trim().min(1),
  readyToSummarize: z.boolean(),
  detected: z.object({
    facts: z.array(z.string()),
    emotions: z.array(z.string()),
    needs: z.array(z.string()),
  }),
  safetyFlag: z.boolean(),
});

export type MediatorReply = z.infer<typeof mediatorReplySchema>;

/**
 * Schema sent to OpenRouter so providers that support structured output return
 * exactly the shape `mediatorReplySchema` validates.
 */
const mediatorReplyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "readyToSummarize", "detected", "safetyFlag"],
  properties: {
    reply: {
      type: "string",
      description: "The message shown to the participant.",
    },
    readyToSummarize: { type: "boolean" },
    detected: {
      type: "object",
      additionalProperties: false,
      required: ["facts", "emotions", "needs"],
      properties: {
        facts: { type: "array", items: { type: "string" } },
        emotions: { type: "array", items: { type: "string" } },
        needs: { type: "array", items: { type: "string" } },
      },
    },
    safetyFlag: { type: "boolean" },
  },
} as const;

type HistoryMessage = {
  role: MessageRole;
  content: string;
};

type MediatorTurn = {
  participantName: string;
  otherName: string;
  history: HistoryMessage[];
  content: string;
};

/** Output cap for one mediator reply, as agreed with the product team. */
const MAX_OUTPUT_TOKENS = 1000;

function isRateLimitError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    error.statusCode === 429
  );
}

function parseReply(text: string): MediatorReply {
  const json = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    // Some providers ignore the JSON schema and leave quotes inside strings
    // unescaped. Repair those replies instead of failing the user's turn.
    try {
      parsed = JSON.parse(jsonrepair(json));
    } catch (error) {
      console.error("[mediator] model reply was not valid JSON", error);
      throw ApiError.internal(error);
    }
  }

  const result = mediatorReplySchema.safeParse(parsed);

  if (!result.success) {
    console.error(
      "[mediator] model reply did not match the schema",
      result.error.issues,
    );
    throw ApiError.internal(result.error);
  }

  return result.data;
}

/**
 * Runs one mediator turn against the caller's full private history.
 *
 * `stage` is pinned to `problem_explaining` because the product only accepts
 * new messages while the conflict status is `collecting`, which is step 1.
 */
export async function completeMediatorTurn({
  participantName,
  otherName,
  history,
  content,
}: MediatorTurn): Promise<MediatorReply> {
  const result = getOpenRouterClient().callModel({
    model: getMessageModel(),
    instructions: buildMessageSystemPrompt({
      stage: "problem_explaining",
      participantName,
      otherName,
    }),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    input: [
      ...history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      { role: "user" as const, content },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "mediator_reply",
        strict: true,
        schema: mediatorReplyJsonSchema,
      },
    },
  });

  try {
    return parseReply(await result.getText());
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (isRateLimitError(error)) {
      throw ApiError.rateLimited();
    }

    throw ApiError.internal(error);
  }
}
