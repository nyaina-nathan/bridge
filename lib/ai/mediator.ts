import { z } from "zod";

import type { MessageRole } from "../types/message.types";
import { buildMessageSystemPrompt } from "../prompts/message.prompts";
import { getMessageModel, getOpenRouterClient } from "./openrouter";
import { parseJsonReply, readModelText, rethrowModelError } from "./structured";

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

/**
 * Output cap for one mediator reply. Reasoning tokens count toward this cap,
 * so leave headroom even though reasoning is disabled below.
 */
const MAX_OUTPUT_TOKENS = 2000;

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
    // The reply is short and the prompt already fixes its shape; reasoning
    // tokens would only risk leaving no budget for the JSON message.
    reasoning: { enabled: false },
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
    return parseJsonReply(
      await readModelText(result, "mediator"),
      mediatorReplySchema,
      "mediator",
    );
  } catch (error) {
    rethrowModelError(error);
  }
}
