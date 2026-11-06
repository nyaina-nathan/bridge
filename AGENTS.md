<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Bridge

Bridge is a private, consent-first conflict mediator for couples. Each partner has a private AI-mediated thread, then explicitly approves what the other can see. The product is an MVP: auth, conflicts, the private mediator chat, perspectives (summary, partner view, approval), and feelings sharing are implemented. Some items in `docs/api/openapi.yml`, such as the v2 features listed there, are still unbuilt.

## Commands

```bash
npm run dev      # next dev (Turbopack)
npm run build    # production build; also type-checks
npm run start    # run the production build
npm run lint     # eslint via eslint-config-next
npm test         # vitest unit suite (__test__/unit)
npm run test:integration # Testcontainers + PostgreSQL API integration suite
npx tsc --noEmit # optional standalone TypeScript check
```

Unit tests live in `__test__/unit/*.unit-test.ts` and run with Vitest. Integration tests live in `__test__/integration/*.integration-test.ts`, boot a disposable PostgreSQL container, and call the route handlers directly; they require Docker. There is no formatter script yet. Verify changes with `npm test`, `npm run test:integration` when touching API/DB code, `npm run lint`, and `npm run build`, and exercise the affected flow in the browser.

## Environment

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — PostgreSQL connection string (the current database is Neon-compatible).
- `JWT_SECRET` — at least 32 characters.
- `OPENROUTER_API_KEY` — OpenRouter key.
- `OPENROUTER_MODEL` — optional; defaults to `openai/gpt-4.1-mini`.

Never commit `.env` or expose these values to client components.

## Stack

- **Next.js 16.4** App Router, React 19, TypeScript strict mode.
- **Tailwind CSS v4** via `@tailwindcss/turbopack` (configured in `next.config.ts`), CSS-first theme in `app/globals.css`. There is no `tailwind.config`.
- **Prisma 7** with the `prisma-client` generator and `@prisma/adapter-pg`.
- **Auth** with `jose` JWTs and opaque, hashed refresh tokens stored in PostgreSQL.
- **AI** with the `@openrouter/sdk`, Zod-validated structured output, and `jsonrepair` for malformed model replies.

## Next.js 16 conventions

Read `node_modules/next/dist/docs/` before using a Next.js API. These details are specific to this project:

- `proxy.ts` is the Next.js 16 replacement for `middleware.ts`. It validates the access cookie, attempts a transparent refresh, redirects unauthenticated pages to `/login`, and sends authenticated users away from `/login` and `/register`. Do not add a `middleware.ts`.
- `cacheComponents: true` and `partialPrefetching: true` are enabled. Uncached data in a page/layout must be inside a `<Suspense>` boundary, or the segment must explicitly opt out with `export const instant = false`.
- `app/(dashboard)/layout.tsx` sets `instant = false` because it reads the session and couple membership on every request. Keep that opt-out scoped to the dashboard group.
- Dynamic route `params` are async: `const { conflictId } = await params`.
- `PageProps` and `LayoutProps` are global generated helpers. Existing code often declares local prop types, which is also fine.
- Turbopack is the default for `dev` and `build`; do not add `--turbopack` flags.
- `serverExternalPackages: ["@openrouter/sdk"]` is intentional. It keeps SDK class names intact in the minified server build; removing it breaks `callModel().getText()` in production.
- Route handlers and pages that read cookies are dynamic. Return private JSON through the project helpers so responses carry `Cache-Control: no-store`.

## Code map

```text
app/
  (dashboard)/            authenticated route group; dashboard layout gates pairing
  api/                    route handlers (auth, conflicts, messages)
  _components/            UI grouped by area: auth, conflicts, dashboard, landing, ui
  globals.css             Tailwind import, theme tokens, shared animations
  layout.tsx              fonts, metadata, root shell
proxy.ts                  auth guard + access-token refresh
lib/
  ai/                     OpenRouter client, mediator turn, summarizer, partner-view rewrite
  api/                    route wrapper, auth guards, ApiError, cookies, browser client
  auth/                   JWT signing/verification
  db/prisma.ts            shared Prisma client with pg adapter
  prompts/                system prompts
  services/               business logic and all Prisma queries (auth, conflict, message, perspective)
  types/                  API-facing camelCase types
  validators/             Zod schemas + request parsers
prisma/
  schema.prisma           database models
  generated/              committed Prisma client; never edit by hand
docs/
  api/openapi.yml         canonical API contract (may lead the implementation for v2 items)
  db/V1__table_init.sql   canonical schema, constraints, and v2 notes
prisma7.config.ts         Prisma 7 CLI config (schema, migrations, datasource)
next.config.ts            Turbopack CSS rule, Cache Components, SDK externalization
```

## Request and data flow

Route handlers follow this shape:

```ts
export const POST = withErrorHandling<{ conflictId: string }>(
  async (request, { params }) => {
    const { userId, coupleId } = await requireAuth(request);
    const { conflictId } = await params;
    const input = await parseSendMessageRequest(request);
    const result = await sendMessage(conflictId, coupleId, userId, input);

    return jsonResponse(result, 201);
  },
);
```

Rules that keep the layers consistent:

- **Route handler**: authenticate, parse, call one service, return a response. Use `withErrorHandling` from `lib/api/handler.ts` and `jsonResponse` from `lib/api/json.ts`.
- **Validation**: define a Zod schema and `parse*Request` helper in `lib/validators/`. Validation failures become `ApiError.validation({ field: message })`.
- **Service**: own the business rules and every Prisma query. Throw `ApiError` for expected failures; never return ad-hoc error bodies.
- **Types**: services map snake_case Prisma rows to camelCase API types from `lib/types/`. Do not leak rows, `password_hash`, or `token_hash` to responses.
- **Server Components**: call services directly with `getServerAuthContext()`; do not fetch the app's own HTTP API.
- **Client Components**: use `postJson` / `ApiClientError` from `lib/api/client.ts`, show field errors when `error.fields` exists, and call `router.refresh()` after mutations that change server-rendered data.
- **Cookies**: use `authResponse`, `sessionResponse`, `refreshResponse`, and `clearAuthCookies` from `lib/api/auth-response.ts` so cookie flags and `no-store` stay consistent.

## How to add a feature

### Backend/API feature

1. Add or update the endpoint in `docs/api/openapi.yml`. It is the contract, even when implementation lags.
2. Add request/response types in `lib/types/` and a Zod schema + parser in `lib/validators/`.
3. Implement the rule in `lib/services/`, scoping every query to the authenticated `coupleId` and, for private data, the requesting `userId`.
4. Create `app/api/**/route.ts` with `withErrorHandling`, `requireAuth`, the parser, the service, and `jsonResponse` (or an auth response helper).
5. Add the matching error code in `lib/api/errors.ts` only if the OpenAPI contract defines it. Prefer existing codes.
6. Update client types/calls if the UI consumes the endpoint.
7. Run `npm run lint` and `npm run build`.

### UI feature

1. Add the page under `app/(dashboard)/dashboard/**` for authenticated content, or `app/**` for public content.
2. Fetch on the server through a service and `getServerAuthContext()`. Use `React.cache` to dedupe repeated reads within one render.
3. Put interactive pieces in a separate `"use client"` component under `app/_components/<area>/`.
4. Reuse `Button`/`ButtonLink`, `Field`, and `Container` from `app/_components/ui/`; merge classes with `cx` from `lib/utils/cx.ts`.
5. Use the existing visual language: `bone`/`paper` backgrounds, `ink`/`muted` text, `rose`/`sage` accents, `font-display` (Fraunces), `shadow-card`/`shadow-lift`, and the `ease-out-strong` token. Respect `prefers-reduced-motion`.
6. Add a route-level `loading.tsx` or a `<Suspense>` fallback when data can stream.
7. Keep private data out of prefetched/cached client state; use `no-store` responses.

### Database change

1. Update the schema reference in `docs/db/` and `prisma/schema.prisma`.
2. Apply the change to the database. **There is currently no `prisma/migrations/` history**, so inspect how the target database was provisioned before choosing `db push`, `migrate`, or a reviewed SQL script. Do not assume a migration chain exists.
3. Run `npx prisma generate`. The generated output is `prisma/generated/` and is committed; never edit it manually.
4. Update service mappings and API types for any renamed/added columns.

## Privacy and authorization rules

These are product invariants, not optional checks:

- A user may only access a conflict where `conflict.couple_id === auth.coupleId`.
- A user may only read/write messages where `message.user_id === auth.userId`.
- Cross-couple access and malformed UUIDs resolve as `404`, not `403`, to avoid confirming existence.
- A user cannot create a conflict until the couple has two members.
- Messages are accepted only while the conflict status is `collecting`.
- `perspectives.approved_at` and `perspectives.feelings_shared_at` are the consent gates for partner-visible content.
- Editing or regenerating a summary clears `perspectives.partner_view` and `approved_at`. A partner view must exist before it can be approved.
- `GET /conflicts/:id/partner-perspective` returns only the partner's approved partner view and, once shared, their feelings. It never returns their summary or private messages, and it is unavailable until the conflict is `feedback` or `closed`.
- The conflict moves to `feedback` only after both partners approve. Approval locks the conflict row so simultaneous approvals serialize.
- Feelings can only be written while the conflict status is `feedback`.
- Safety-flagged model replies set `conflicts.flagged`; preserve the safety notice behavior in `lib/services/message.service.ts`.

## Conventions

- Path alias: `@/*` maps to the repository root. App code imports with `@/`; files inside `lib/` often use relative imports. Match the surrounding file.
- TypeScript is strict; avoid `any` and unchecked casts. Prisma `status`/`outcome`/`role` are strings in the schema and narrowed in services/types.
- Use double quotes, trailing commas, and two-space indentation.
- Keep comments focused on non-obvious decisions (auth refresh, transaction locking, JSON repair, caching) rather than restating code.
- Prefer semantic HTML and accessible states (`aria-busy`, `aria-invalid`, labels, focus styles, screen-reader text). Existing dialogs use native `<dialog>`.
- Do not add a new icon library, state manager, or data-fetching library without a concrete need; the app currently uses local icons, React state, and server components.
