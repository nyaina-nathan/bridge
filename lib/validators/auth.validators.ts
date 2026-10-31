import { z } from "zod";

import { ApiError } from "../api/errors";

/**
 * bcrypt only consumes the first 72 bytes of a password. Reject longer
 * passwords instead of silently truncating them at hash time.
 */
const MAX_PASSWORD_BYTES = 72;

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export const registerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Must be a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine(
      (value) => utf8ByteLength(value) <= MAX_PASSWORD_BYTES,
      `Password must be at most ${MAX_PASSWORD_BYTES} bytes`,
    ),
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((value) => value || undefined),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Must be a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

function formatIssues(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "body";
    fields[field] ??= issue.message;
  }

  return fields;
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw ApiError.validation({ body: "Request body must be valid JSON" });
  }
}

function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw ApiError.validation(formatIssues(result.error));
  }

  return result.data;
}

export async function parseRegisterRequest(
  request: Request,
): Promise<RegisterInput> {
  return parseBody(registerSchema, await readJsonBody(request));
}

export async function parseLoginRequest(
  request: Request,
): Promise<LoginInput> {
  return parseBody(loginSchema, await readJsonBody(request));
}
