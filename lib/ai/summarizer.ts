import { z } from "zod";

import { buildSummarySystemPrompt } from "../prompts/summary.prompts";
import type { MessageRole } from "../types/message.types";
import { getMessageModel, getOpenRouterClient } from "./openrouter";
import { parseJsonReply, rethrowModelError } from "./structured";

export const summaryOutputSchema = z.object({
  summary: z.string().trim().min(1),
});

export type SummaryOutput = z.infer<typeof summaryOutputSchema>;

/**
 * Schema sent to OpenRouter so providers that support structured output return
 * exactly the shape `summaryOutputSchema` validates.
 */
const summaryJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary"],
  properties: {
    summary: {
      type: "string",
      description: "The participant's first-person summary.",
    },
  },
} as const;

type SummaryHistoryMessage = {
  role: MessageRole;
  content: string;
};

type SummaryTurn = {
  participantName: string;
  history: SummaryHistoryMessage[];
};

/** Output cap for one summary, as agreed with the product team. */
const MAX_OUTPUT_TOKENS = 1000;

/**
 * The stored thread always ends with the mediator's reply. Anthropic-backed
 * providers treat a trailing assistant message as prefill and reject it, so the
 * summary request closes with an explicit user instruction instead.
 */
const SUMMARY_REQUEST =
  "Now write my summary from the conversation above. Follow the system instructions and return only the JSON object. This line is an instruction, not part of my story.";

/**
 * Drafts the participant's summary from their private thread with the mediator.
 * The existing perspective is only overwritten after a successful generation.
 */
export async function summarizeThread({
  participantName,
  history,
}: SummaryTurn): Promise<SummaryOutput> {
  const result = getOpenRouterClient().callModel({
    model: getMessageModel(),
    instructions: buildSummarySystemPrompt({ participantName }),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    input: [
      ...history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      { role: "user" as const, content: SUMMARY_REQUEST },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "perspective_summary",
        strict: true,
        schema: summaryJsonSchema,
      },
    },
  });

  try {
    return parseJsonReply(
      await result.getText(),
      summaryOutputSchema,
      "summary",
    );
  } catch (error) {
    rethrowModelError(error);
  }
}
