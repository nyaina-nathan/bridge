import { z } from "zod";

import { parseBody, readJsonBody } from "./http";

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
