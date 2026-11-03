import { NextResponse, type NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";

import { ApiError, isApiError } from "./errors";

/**
 * The second argument Next.js passes to App Router route handlers. `params` is
 * async in Next.js 15+, so handlers must `await` it.
 */
export type RouteContext<TParams> = {
  params: Promise<TParams>;
};

export type RouteHandler<TParams> = (
  request: NextRequest,
  context: RouteContext<TParams>,
) => Response | Promise<Response>;

/**
 * Wraps a route handler so thrown `ApiError`s become the OpenAPI error body and
 * anything else becomes a logged 500 without leaking internals.
 *
 * @example
 * export const GET = withErrorHandling<{ conflictId: string }>(
 *   async (_request, { params }) => {
 *     const { conflictId } = await params;
 *     const conflict = await findConflict(conflictId);
 *     if (!conflict) throw ApiError.notFound();
 *     return NextResponse.json(conflict);
 *   },
 * );
 */
export function withErrorHandling<TParams = Record<string, string>>(
  handler: RouteHandler<TParams>,
): RouteHandler<TParams> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Let Next.js control-flow errors (prerender bailouts, redirects,
      // notFound) propagate instead of turning them into a 500.
      console.error(
        `[api] ${request.method} ${request.nextUrl.pathname}`,
        error,
      );
      unstable_rethrow(error);

      if (isApiError(error)) {
        return NextResponse.json(error.toJSON(), {
          status: error.status,
          headers: error.headers,
        });
      }

      
      const internal = ApiError.internal(error);
      return NextResponse.json(internal.toJSON(), {
        status: internal.status,
      });
    }
  };
}
