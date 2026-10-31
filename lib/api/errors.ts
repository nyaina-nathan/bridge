/**
 * Error codes and statuses mirroring the `Error` schema in docs/api/openapi.yml.
 *
 * The status is derived from the code so the two can never drift apart.
 */
export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  INVALID_REFRESH_TOKEN: 401,
  PARTNER_NOT_JOINED: 403,
  ACTION_NOT_ALLOWED: 403,
  CONFLICT_NOT_FOUND: 404,
  INVALID_INVITE_CODE: 404,
  EMAIL_TAKEN: 409,
  COUPLE_FULL: 409,
  INVALID_STATE_TRANSITION: 409,
  NOT_ENOUGH_CONTEXT: 409,
  SUMMARY_MISSING: 409,
  PARTNER_VIEW_MISSING: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const satisfies Record<string, number>;

export type ErrorCode = keyof typeof ERROR_STATUS;

/** The response body shape declared by `components.schemas.Error`. */
export type ErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string>;
  };
};

type CodeForStatus<S extends number> = {
  [K in ErrorCode]: (typeof ERROR_STATUS)[K] extends S ? K : never;
}[ErrorCode];

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Validation failed",
  UNAUTHORIZED: "Missing or expired access token",
  INVALID_CREDENTIALS: "Invalid email or password",
  INVALID_REFRESH_TOKEN: "Refresh token is missing, expired or revoked",
  PARTNER_NOT_JOINED: "Your partner has not joined yet",
  ACTION_NOT_ALLOWED: "This action is not allowed in the current state",
  CONFLICT_NOT_FOUND: "Conflict not found",
  INVALID_INVITE_CODE: "Invite code is invalid",
  EMAIL_TAKEN: "This email is already registered",
  COUPLE_FULL: "This couple already has 2 members",
  INVALID_STATE_TRANSITION:
    "This action is not allowed in the current state",
  NOT_ENOUGH_CONTEXT: "Not enough context to generate a summary",
  SUMMARY_MISSING: "Generate or write a summary first",
  PARTNER_VIEW_MISSING: "Generate a partner view first",
  RATE_LIMITED: "Too many requests, please try again later",
  INTERNAL_ERROR: "Something went wrong",
};

export type ApiErrorOptions = {
  /** Field-level messages, only used by VALIDATION_ERROR. */
  fields?: Record<string, string>;
  /** Extra response headers, e.g. Retry-After. */
  headers?: Record<string, string>;
  cause?: unknown;
};

/**
 * The single error type thrown by route handlers and services. The route
 * wrapper in `handler.ts` turns it into the OpenAPI error response.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;
  readonly headers?: Record<string, string>;

  constructor(code: ErrorCode, message?: string, options: ApiErrorOptions = {}) {
    super(message ?? DEFAULT_MESSAGES[code], { cause: options.cause });
    this.name = "ApiError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.fields = options.fields;
    this.headers = options.headers;
  }

  toJSON(): ErrorBody {
    const error: ErrorBody["error"] = {
      code: this.code,
      message: this.message,
    };

    if (this.fields) {
      error.fields = this.fields;
    }

    return { error };
  }

  static validation(
    fields: Record<string, string>,
    message?: string,
  ): ApiError {
    return new ApiError("VALIDATION_ERROR", message, { fields });
  }

  static unauthorized(
    code: CodeForStatus<401> = "UNAUTHORIZED",
    message?: string,
  ): ApiError {
    return new ApiError(code, message);
  }

  static invalidCredentials(message?: string): ApiError {
    return new ApiError("INVALID_CREDENTIALS", message);
  }

  static invalidRefreshToken(message?: string): ApiError {
    return new ApiError("INVALID_REFRESH_TOKEN", message);
  }

  static forbidden(
    code: CodeForStatus<403> = "ACTION_NOT_ALLOWED",
    message?: string,
  ): ApiError {
    return new ApiError(code, message);
  }

  static notFound(
    code: CodeForStatus<404> = "CONFLICT_NOT_FOUND",
    message?: string,
  ): ApiError {
    return new ApiError(code, message);
  }

  static conflict(
    code: CodeForStatus<409> = "INVALID_STATE_TRANSITION",
    message?: string,
  ): ApiError {
    return new ApiError(code, message);
  }

  static rateLimited(
    options: { retryAfter?: number; message?: string } = {},
  ): ApiError {
    const headers =
      options.retryAfter === undefined
        ? undefined
        : { "Retry-After": String(options.retryAfter) };

    return new ApiError("RATE_LIMITED", options.message, { headers });
  }

  static internal(cause?: unknown): ApiError {
    return new ApiError("INTERNAL_ERROR", undefined, { cause });
  }
}

/**
 * Cross-realm/bundle-safe check. `instanceof` alone is not enough when server
 * code is bundled more than once; the shape check acts as a fallback.
 */
export function isApiError(value: unknown): value is ApiError {
  if (value instanceof ApiError) {
    return true;
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ApiError>;

  return (
    candidate.name === "ApiError" &&
    typeof candidate.code === "string" &&
    candidate.code in ERROR_STATUS &&
    typeof candidate.status === "number" &&
    typeof candidate.message === "string" &&
    typeof candidate.toJSON === "function"
  );
}
