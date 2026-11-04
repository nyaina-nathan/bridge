/** Field-level messages returned by `VALIDATION_ERROR` responses. */
export type ApiErrorFields = Record<string, string>;

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    fields?: ApiErrorFields;
  };
};

type ApiClientErrorOptions = {
  status?: number;
  code?: string;
  fields?: ApiErrorFields;
};

/**
 * Error thrown by `postJson`. Mirrors the OpenAPI `Error` body so callers can
 * show field-level messages when the API provides them.
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields?: ApiErrorFields;

  constructor(message: string, options: ApiClientErrorOptions = {}) {
    super(message);
    this.name = "ApiClientError";
    this.status = options.status ?? 0;
    this.code = options.code;
    this.fields = options.fields;
  }
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return typeof value === "object" && value !== null && "error" in value;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

type JsonMethod = "POST" | "PUT";

async function sendJson<T>(
  path: string,
  method: JsonMethod,
  body: unknown,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError(
      "Couldn’t reach Bridge. Check your connection and try again.",
    );
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const error = isApiErrorPayload(payload) ? payload.error : undefined;

    throw new ApiClientError(
      error?.message ?? "Something went wrong. Please try again.",
      {
        status: response.status,
        code: error?.code,
        fields: error?.fields,
      },
    );
  }

  return payload as T;
}

/**
 * Posts JSON to a same-origin API route and returns the parsed body.
 *
 * @example
 * await postJson<AuthSession>("/api/auth/login", { email, password });
 */
export function postJson<T>(path: string, body: unknown): Promise<T> {
  return sendJson(path, "POST", body);
}

/**
 * Sends a JSON PUT to a same-origin API route and returns the parsed body.
 *
 * @example
 * await putJson<Perspective>(`/api/conflicts/${id}/perspective`, { summary });
 */
export function putJson<T>(path: string, body: unknown): Promise<T> {
  return sendJson(path, "PUT", body);
}
