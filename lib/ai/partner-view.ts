import { z } from "zod";

import { buildPartnerViewSystemPrompt } from "../prompts/partner-view.prompts";
import { getMessageModel, getOpenRouterClient } from "./openrouter";
import {
  parseJsonReply,
  readModelText,
  rethrowModelError,
} from "./structured";

export const partnerViewOutputSchema = z.object({
  partnerView: z.string().trim().min(1),
});

export type PartnerViewOutput = z.infer<typeof partnerViewOutputSchema>;

/**
 * Schema sent to OpenRouter so providers that support structured output return
 * exactly the shape `partnerViewOutputSchema` validates.
 */
const partnerViewJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["partnerView"],
  properties: {
    partnerView: {
      type: "string",
      description: "The calm first-person message for the partner.",
    },
  },
} as const;

type PartnerViewTurn = {
  participantName: string;
  summary: string;
};

/**
 * Output cap for one partner view. Reasoning tokens count toward this cap, so
 * leave headroom even though reasoning is disabled below.
 */
const MAX_OUTPUT_TOKENS = 2000;

/**
 * Reframes the participant's own summary into the message their partner reads,
 * keeping the participant's first-person voice. The existing partner view and
 * approval are only replaced after a successful generation.
 */
export async function rewriteForPartner({
  participantName,
  summary,
}: PartnerViewTurn): Promise<PartnerViewOutput> {
  const result = getOpenRouterClient().callModel({
    model: getMessageModel(),
    instructions: buildPartnerViewSystemPrompt({ participantName }),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    // Rewriting a summary needs no chain-of-thought, and reasoning tokens would
    // otherwise consume the output budget before any JSON is produced.
    reasoning: { enabled: false },
    input: [{ role: "user" as const, content: summary }],
    text: {
      format: {
        type: "json_schema",
        name: "partner_view",
        strict: true,
        schema: partnerViewJsonSchema,
      },
    },
  });

  try {
    return parseJsonReply(
      await readModelText(result, "partner-view"),
      partnerViewOutputSchema,
      "partner-view",
    );
  } catch (error) {
    rethrowModelError(error);
  }
}
