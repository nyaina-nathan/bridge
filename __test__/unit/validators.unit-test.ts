import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ApiError } from "@/lib/api/errors";
import {
  loginSchema,
  parseLoginRequest,
  parseRegisterRequest,
  registerSchema,
} from "@/lib/validators/auth.validators";
import {
  closeConflictSchema,
  conflictOutcomeSchema,
  createConflictSchema,
  isValidConflictId,
  parseCloseConflictRequest,
  parseCreateConflictRequest,
} from "@/lib/validators/conflict.validators";
import {
  formatIssues,
  parseBody,
  readJsonBody,
} from "@/lib/validators/http";
import {
  parseSendMessageRequest,
  sendMessageSchema,
} from "@/lib/validators/message.validators";
import {
  parseShareFeelingsRequest,
  parseUpdatePerspectiveRequest,
  shareFeelingsSchema,
  updatePerspectiveSchema,
} from "@/lib/validators/perspective.validators";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function jsonRequest(body: unknown): Request {
  return new Request("http://bridge.test/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("lib/validators/http", () => {
  it("formats nested issues into dot-separated field paths", () => {
    const schema = z.object({
      user: z.object({
        email: z.string().min(1, "Email is required"),
      }),
    });
    const result = schema.safeParse({ user: { email: "" } });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(formatIssues(result.error)).toEqual({
      "user.email": "Email is required",
    });
  });

  it("falls back to `body` when the issue has no path", () => {
    const result = z.string().min(1, "Body is required").safeParse("");

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(formatIssues(result.error)).toEqual({ body: "Body is required" });
  });

  it("keeps the first message for a duplicated field", () => {
    const result = z
      .string()
      .min(5, "Too short")
      .regex(/^x/, "Must start with x")
      .safeParse("a");

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(formatIssues(result.error)).toEqual({ body: "Too short" });
  });

  it("parses a JSON request body", async () => {
    await expect(readJsonBody(jsonRequest({ a: 1 }))).resolves.toEqual({
      a: 1,
    });
  });

  it("maps malformed JSON to a validation error", async () => {
    await expect(readJsonBody(jsonRequest("{ nope"))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      fields: { body: "Request body must be valid JSON" },
    });
  });

  it("returns parsed data for valid bodies", () => {
    expect(parseBody(z.object({ a: z.number() }), { a: 1 })).toEqual({ a: 1 });
  });

  it("throws a validation ApiError for invalid bodies", () => {
    expect(() => parseBody(z.object({ a: z.number() }), {})).toThrow(ApiError);
  });
});

describe("auth validators", () => {
  it("normalises a valid registration payload", () => {
    const result = registerSchema.parse({
      displayName: "  Ada  ",
      email: "  ADA@Example.COM ",
      password: "supersecret",
      inviteCode: " abc123 ",
    });

    expect(result).toEqual({
      displayName: "Ada",
      email: "ada@example.com",
      password: "supersecret",
      inviteCode: "ABC123",
    });
  });

  it("turns a blank invite code into undefined", () => {
    expect(
      registerSchema.parse({
        displayName: "Ada",
        email: "ada@example.com",
        password: "supersecret",
        inviteCode: "   ",
      }).inviteCode,
    ).toBeUndefined();
  });

  it("requires a display name and a valid email", () => {
    const result = registerSchema.safeParse({
      displayName: "   ",
      email: "not-an-email",
      password: "supersecret",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(formatIssues(result.error)).toEqual({
      displayName: "Display name is required",
      email: "Must be a valid email",
    });
  });

  it("requires at least 8 password characters", () => {
    const result = registerSchema.safeParse({
      displayName: "Ada",
      email: "ada@example.com",
      password: "1234567",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(formatIssues(result.error)).toEqual({
      password: "Password must be at least 8 characters",
    });
  });

  it("accepts exactly 72 password bytes", () => {
    expect(
      registerSchema.safeParse({
        displayName: "Ada",
        email: "ada@example.com",
        password: "a".repeat(72),
      }).success,
    ).toBe(true);
  });

  it("rejects passwords longer than 72 bytes", () => {
    const result = registerSchema.safeParse({
      displayName: "Ada",
      email: "ada@example.com",
      password: "a".repeat(73),
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(formatIssues(result.error)).toEqual({
      password: "Password must be at most 72 bytes",
    });
  });

  it("counts UTF-8 bytes rather than characters", () => {
    // "é" is two bytes, so 36 characters hit the 72-byte cap exactly.
    expect(
      registerSchema.safeParse({
        displayName: "Ada",
        email: "ada@example.com",
        password: "é".repeat(36),
      }).success,
    ).toBe(true);

    expect(
      registerSchema.safeParse({
        displayName: "Ada",
        email: "ada@example.com",
        password: "é".repeat(37),
      }).success,
    ).toBe(false);
  });

  it("normalises login emails and rejects an empty password", () => {
    expect(
      loginSchema.parse({ email: " ADA@Example.com ", password: "x" }),
    ).toEqual({ email: "ada@example.com", password: "x" });

    const result = loginSchema.safeParse({
      email: "ada@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(formatIssues(result.error)).toEqual({
      password: "Password is required",
    });
  });

  it("parses register and login requests", async () => {
    await expect(
      parseRegisterRequest(
        jsonRequest({
          displayName: "Ada",
          email: "ada@example.com",
          password: "supersecret",
        }),
      ),
    ).resolves.toMatchObject({ email: "ada@example.com" });

    await expect(
      parseLoginRequest(
        jsonRequest({ email: "ADA@example.com", password: "secret" }),
      ),
    ).resolves.toEqual({ email: "ada@example.com", password: "secret" });
  });
});

describe("conflict validators", () => {
  it("trims titles and enforces the length limits", () => {
    expect(createConflictSchema.parse({ title: "  The dishes  " })).toEqual({
      title: "The dishes",
    });

    expect(createConflictSchema.safeParse({ title: "   " }).success).toBe(false);
    expect(
      createConflictSchema.safeParse({ title: "a".repeat(121) }).success,
    ).toBe(false);
  });

  it("accepts only the known outcomes", () => {
    expect(conflictOutcomeSchema.parse("resolved")).toBe("resolved");
    expect(conflictOutcomeSchema.parse("later")).toBe("later");
    expect(conflictOutcomeSchema.parse("unsolvable")).toBe("unsolvable");
    expect(conflictOutcomeSchema.safeParse("other").success).toBe(false);
  });

  it("parses close requests", async () => {
    await expect(
      parseCloseConflictRequest(jsonRequest({ outcome: "later" })),
    ).resolves.toEqual({ outcome: "later" });

    await expect(
      parseCloseConflictRequest(jsonRequest({ outcome: "other" })),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      fields: { outcome: expect.any(String) },
    });
  });

  it("validates conflict ids", () => {
    expect(isValidConflictId(VALID_UUID)).toBe(true);
    expect(isValidConflictId("not-a-uuid")).toBe(false);
    expect(isValidConflictId("")).toBe(false);
    expect(isValidConflictId(VALID_UUID.toUpperCase())).toBe(true);
  });

  it("parses create requests", async () => {
    await expect(
      parseCreateConflictRequest(jsonRequest({ title: "The dishes" })),
    ).resolves.toEqual({ title: "The dishes" });
  });

  it("uses the outcome enum in the close schema", () => {
    expect(
      closeConflictSchema.safeParse({ outcome: "resolved" }).success,
    ).toBe(true);
    expect(closeConflictSchema.safeParse({}).success).toBe(false);
  });
});

describe("message validators", () => {
  it("trims content and rejects empty messages", () => {
    expect(sendMessageSchema.parse({ content: "  hello  " })).toEqual({
      content: "hello",
    });

    const result = sendMessageSchema.safeParse({ content: "   " });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(formatIssues(result.error)).toEqual({
      content: "Message is required",
    });
  });

  it("parses send requests", async () => {
    await expect(
      parseSendMessageRequest(jsonRequest({ content: "hello" })),
    ).resolves.toEqual({ content: "hello" });
  });
});

describe("perspective validators", () => {
  it("trims the summary and rejects blanks", () => {
    expect(updatePerspectiveSchema.parse({ summary: "  my side  " })).toEqual({
      summary: "my side",
    });

    expect(updatePerspectiveSchema.safeParse({ summary: "  " }).success).toBe(
      false,
    );
  });

  it("trims feelings and rejects blanks", () => {
    expect(shareFeelingsSchema.parse({ feelings: "  relieved  " })).toEqual({
      feelings: "relieved",
    });

    expect(shareFeelingsSchema.safeParse({ feelings: "  " }).success).toBe(
      false,
    );
  });

  it("parses perspective requests", async () => {
    await expect(
      parseUpdatePerspectiveRequest(jsonRequest({ summary: "my side" })),
    ).resolves.toEqual({ summary: "my side" });

    await expect(
      parseShareFeelingsRequest(jsonRequest({ feelings: "relieved" })),
    ).resolves.toEqual({ feelings: "relieved" });
  });
});
