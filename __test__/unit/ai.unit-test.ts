import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  completeMediatorTurn,
  mediatorReplySchema,
} from "@/lib/ai/mediator";
import {
  partnerViewOutputSchema,
  rewriteForPartner,
} from "@/lib/ai/partner-view";
import {
  isRateLimitError,
  parseJsonReply,
  rethrowModelError,
} from "@/lib/ai/structured";
import {
  summarizeThread,
  summaryOutputSchema,
} from "@/lib/ai/summarizer";
import { ApiError } from "@/lib/api/errors";
import { z } from "zod";

const { callModel, getMessageModel } = vi.hoisted(() => ({
  callModel: vi.fn(),
  getMessageModel: vi.fn(),
}));

vi.mock("@/lib/ai/openrouter", () => ({
  getOpenRouterClient: () => ({ callModel }),
  getMessageModel,
}));

const replyPayload = {
  reply: "  That sounds lonely.  ",
  readyToSummarize: true,
  detected: {
    facts: ["unanswered messages"],
    emotions: ["loneliness"],
    needs: ["reassurance"],
  },
  safetyFlag: false,
};

function mockModelText(text: string) {
  const getText = vi.fn().mockResolvedValue(text);
  callModel.mockReturnValue({ getText });

  return getText;
}

beforeEach(() => {
  getMessageModel.mockReturnValue("test-model");
});

describe("lib/ai/structured isRateLimitError", () => {
  it("detects a 429 statusCode", () => {
    expect(isRateLimitError({ statusCode: 429 })).toBe(true);
  });

  it("ignores other statuses and non-objects", () => {
    expect(isRateLimitError({ statusCode: 500 })).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError("429")).toBe(false);
  });
});

describe("lib/ai/structured parseJsonReply", () => {
  const schema = z.object({ name: z.string(), count: z.number() });

  it("parses a plain JSON object", () => {
    expect(
      parseJsonReply('{"name":"Ada","count":2}', schema, "test"),
    ).toEqual({ name: "Ada", count: 2 });
  });

  it("strips a fenced code block", () => {
    expect(
      parseJsonReply(
        '```json\n{"name":"Ada","count":2}\n```',
        schema,
        "test",
      ),
    ).toEqual({ name: "Ada", count: 2 });
  });

  it("strips an unlabelled code fence", () => {
    expect(
      parseJsonReply('```\n{"name":"Ada","count":2}\n```', schema, "test"),
    ).toEqual({ name: "Ada", count: 2 });
  });

  it("repairs malformed JSON before validation", () => {
    expect(
      parseJsonReply('{"name":"Ada","count":2,}', schema, "test"),
    ).toEqual({ name: "Ada", count: 2 });
  });

  it("rejects unparseable text with an internal error", () => {
    expect(() => parseJsonReply("definitely not json", schema, "test")).toThrow(
      ApiError,
    );

    try {
      parseJsonReply("definitely not json", schema, "test");
    } catch (error) {
      expect((error as ApiError).code).toBe("INTERNAL_ERROR");
    }
  });

  it("rejects JSON that does not match the schema", () => {
    try {
      parseJsonReply('{"name":"Ada","count":"two"}', schema, "test");
      throw new Error("expected parseJsonReply to throw");
    } catch (error) {
      expect((error as ApiError).code).toBe("INTERNAL_ERROR");
    }
  });

  it("logs and keeps the schema issues as the cause", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      parseJsonReply('{"name":1}', schema, "test");
    } catch (error) {
      expect((error as ApiError).cause).toBeDefined();
    }

    expect(errorSpy).toHaveBeenCalledWith(
      "[test] model reply did not match the schema",
      expect.any(Array),
    );
    errorSpy.mockRestore();
  });
});

describe("lib/ai/structured rethrowModelError", () => {
  it("passes ApiErrors through unchanged", () => {
    const original = ApiError.notFound();

    expect(() => rethrowModelError(original)).toThrow(original);
  });

  it("maps rate limits onto RATE_LIMITED", () => {
    try {
      rethrowModelError({ statusCode: 429 });
      throw new Error("expected rethrowModelError to throw");
    } catch (error) {
      expect((error as ApiError).code).toBe("RATE_LIMITED");
      expect((error as ApiError).status).toBe(429);
    }
  });

  it("wraps unknown failures as INTERNAL_ERROR", () => {
    const cause = new Error("socket closed");

    try {
      rethrowModelError(cause);
      throw new Error("expected rethrowModelError to throw");
    } catch (error) {
      expect((error as ApiError).code).toBe("INTERNAL_ERROR");
      expect((error as ApiError).cause).toBe(cause);
    }
  });
});

describe("mediator reply schema", () => {
  it("accepts a complete reply", () => {
    expect(mediatorReplySchema.safeParse(replyPayload).success).toBe(true);
  });

  it("trims the reply text", () => {
    expect(mediatorReplySchema.parse(replyPayload).reply).toBe(
      "That sounds lonely.",
    );
  });

  it("rejects blank replies and missing detection data", () => {
    expect(
      mediatorReplySchema.safeParse({ ...replyPayload, reply: "   " }).success,
    ).toBe(false);
    expect(
      mediatorReplySchema.safeParse({
        ...replyPayload,
        detected: undefined,
      }).success,
    ).toBe(false);
  });
});

describe("lib/ai/mediator completeMediatorTurn", () => {
  it("sends the private history and strict JSON schema to the model", async () => {
    mockModelText(JSON.stringify(replyPayload));

    const result = await completeMediatorTurn({
      participantName: "Ada",
      otherName: "Grace",
      history: [
        { role: "user", content: "Earlier" },
        { role: "assistant", content: "Earlier reply" },
      ],
      content: "She ignored me",
    });

    expect(callModel).toHaveBeenCalledWith({
      model: "test-model",
      instructions: expect.stringContaining("private conversation with Ada"),
      maxOutputTokens: 1000,
      input: [
        { role: "user", content: "Earlier" },
        { role: "assistant", content: "Earlier reply" },
        { role: "user", content: "She ignored me" },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "mediator_reply",
          strict: true,
          schema: expect.objectContaining({
            type: "object",
            required: [
              "reply",
              "readyToSummarize",
              "detected",
              "safetyFlag",
            ],
          }),
        },
      },
    });
    expect(result).toEqual({ ...replyPayload, reply: "That sounds lonely." });
  });

  it("maps model rate limits", async () => {
    const getText = vi.fn().mockRejectedValue({ statusCode: 429 });
    callModel.mockReturnValue({ getText });

    try {
      await completeMediatorTurn({
        participantName: "Ada",
        otherName: "Grace",
        history: [],
        content: "Hi",
      });
      throw new Error("expected completeMediatorTurn to throw");
    } catch (error) {
      expect((error as ApiError).code).toBe("RATE_LIMITED");
    }
  });

  it("rejects a malformed model reply", async () => {
    mockModelText("not json");

    try {
      await completeMediatorTurn({
        participantName: "Ada",
        otherName: "Grace",
        history: [],
        content: "Hi",
      });
      throw new Error("expected completeMediatorTurn to throw");
    } catch (error) {
      expect((error as ApiError).code).toBe("INTERNAL_ERROR");
    }
  });
});

describe("lib/ai/summarizer", () => {
  it("accepts only a non-blank summary", () => {
    expect(summaryOutputSchema.safeParse({ summary: "My side" }).success).toBe(
      true,
    );
    expect(summaryOutputSchema.safeParse({ summary: "   " }).success).toBe(
      false,
    );
  });

  it("summarises the private history", async () => {
    mockModelText(JSON.stringify({ summary: "  I felt alone.  " }));

    const result = await summarizeThread({
      participantName: "Ada",
      history: [
        { role: "user", content: "She ignored me" },
        { role: "assistant", content: "That sounds lonely" },
      ],
    });

    expect(callModel).toHaveBeenCalledWith({
      model: "test-model",
      instructions: expect.stringContaining("summary of Ada"),
      maxOutputTokens: 1000,
      input: [
        { role: "user", content: "She ignored me" },
        { role: "assistant", content: "That sounds lonely" },
        {
          role: "user",
          content: expect.stringContaining("Now write my summary"),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "perspective_summary",
          strict: true,
          schema: expect.objectContaining({ type: "object" }),
        },
      },
    });
    expect(result).toEqual({ summary: "I felt alone." });
  });

  it("always ends the model input with a user turn", async () => {
    mockModelText(JSON.stringify({ summary: "I felt alone." }));

    await summarizeThread({
      participantName: "Ada",
      history: [
        { role: "user", content: "She ignored me" },
        { role: "assistant", content: "That sounds lonely" },
      ],
    });

    const request = callModel.mock.calls.at(-1)?.[0] as {
      input: Array<{ role: string; content: string }>;
    };

    expect(request.input.at(-1)?.role).toBe("user");
  });

  it("maps rate limits", async () => {
    callModel.mockReturnValue({
      getText: vi.fn().mockRejectedValue({ statusCode: 429 }),
    });

    try {
      await summarizeThread({ participantName: "Ada", history: [] });
      throw new Error("expected summarizeThread to throw");
    } catch (error) {
      expect((error as ApiError).code).toBe("RATE_LIMITED");
    }
  });
});

describe("lib/ai/partner-view", () => {
  it("accepts only a non-blank partner view", () => {
    expect(
      partnerViewOutputSchema.safeParse({ partnerView: "Ada felt alone." })
        .success,
    ).toBe(true);
    expect(
      partnerViewOutputSchema.safeParse({ partnerView: "   " }).success,
    ).toBe(false);
  });

  it("rewrites the summary for the partner", async () => {
    mockModelText(JSON.stringify({ partnerView: "  Ada felt alone.  " }));

    const result = await rewriteForPartner({
      participantName: "Ada",
      summary: "I felt alone.",
    });

    expect(callModel).toHaveBeenCalledWith({
      model: "test-model",
      instructions: expect.stringContaining("You rewrite Ada's private"),
      maxOutputTokens: 1000,
      input: [{ role: "user", content: "I felt alone." }],
      text: {
        format: {
          type: "json_schema",
          name: "partner_view",
          strict: true,
          schema: expect.objectContaining({ type: "object" }),
        },
      },
    });
    expect(result).toEqual({ partnerView: "Ada felt alone." });
  });

  it("maps a malformed reply to an internal error", async () => {
    mockModelText('{"partnerView": ""}');

    try {
      await rewriteForPartner({ participantName: "Ada", summary: "I felt alone." });
      throw new Error("expected rewriteForPartner to throw");
    } catch (error) {
      expect((error as ApiError).code).toBe("INTERNAL_ERROR");
    }
  });
});
