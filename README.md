<p align="center">
  <img src="public/brand/bridge-mark.png" alt="Bridge logo" width="120" />
</p>

<h1 align="center">Bridge</h1>

<p align="center">
  A private, consent-first conflict mediator for couples.
</p>

Bridge gives each partner a private, AI-mediated space to work through a disagreement. Nothing one person writes is visible to the other until both explicitly approve what the other can see.

> [!TIP]
> A live demo is available at [bridge-amber-seven.vercel.app](https://bridge-amber-seven.vercel.app/).

## Features

- **Private mediator chat.** Each partner talks to the AI in their own thread. Their messages are never shown to their partner.
- **Summaries you control.** The AI drafts a summary of your side. You can edit it until it sounds like you.
- **Partner view.** The AI reframes your summary into a version your partner can hear. You approve or regenerate it.
- **Two-sided consent gate.** The conflict moves forward only after both partners approve. Editing your summary clears the old partner view and approval.
- **Feelings and outcomes.** Once both views are approved, partners read each other's view, share how it landed, and close the conflict as `resolved`, `later`, or `unsolvable`.
- **Safety flagging.** If the AI detects signs that someone may be unsafe, the conflict is flagged and support guidance is shown.

## How it works

1. **Say it privately.** Describe what happened in your own words.
2. **Shape your summary.** Review and edit the AI's summary of your side.
3. **Reframe for your partner.** Generate a partner-friendly version of your summary.
4. **Both approve.** Each partner approves exactly what the other will see.
5. **Read and close.** Read the approved view, share feelings, and record the outcome.

> [!IMPORTANT]
> Consent gates are enforced on the server. A partner's summary and private messages are never returned to the other partner, even through the API.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router, Cache Components) with React 19 and TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/)
- [PostgreSQL](https://www.postgresql.org/) via [Prisma 7](https://www.prisma.io/) and `@prisma/adapter-pg`
- [OpenRouter](https://openrouter.ai/) for AI, with Zod-validated structured output
- JWT access tokens with hashed, rotating refresh tokens

## Getting started

### Prerequisites

- Node.js 20.9 or later (required by Next.js 16)
- A PostgreSQL database (Neon works)
- An OpenRouter API key

### Setup

```bash
git clone <repository-url> bridge
cd bridge
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable             | Description                                                    |
| -------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`       | PostgreSQL connection string                                   |
| `JWT_SECRET`         | Random string, at least 32 characters                          |
| `OPENROUTER_API_KEY` | Your OpenRouter key                                            |
| `OPENROUTER_MODEL`   | Optional. Defaults to `openai/gpt-4.1-mini`                    |

Apply the schema in [`docs/db/V1__table_init.sql`](docs/db/V1__table_init.sql) to your database. The project has no migration history yet, so this file is the reference for the tables and constraints.

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create an account. Your partner registers with the invite code shown on your dashboard to join your couple.

> [!CAUTION]
> Never commit `.env` or expose its values to client components.

## Scripts

| Command                    | Purpose                                              |
| -------------------------- | ---------------------------------------------------- |
| `npm run dev`              | Start the dev server (Turbopack)                     |
| `npm run build`            | Production build, including type checks              |
| `npm run start`            | Run the production build                             |
| `npm run lint`             | Lint with ESLint                                     |
| `npm test`                 | Unit tests (Vitest)                                  |
| `npm run test:integration` | API and database integration tests                   |

> [!NOTE]
> The integration suite starts a disposable PostgreSQL container with Testcontainers, so Docker must be running.

## Project structure

```text
app/
  (dashboard)/      authenticated pages
  api/              route handlers (auth, conflicts, perspectives)
  _components/      UI grouped by area
lib/
  ai/               OpenRouter client, mediator, summarizer, partner-view rewrite
  services/         business rules and all database queries
  validators/       Zod schemas and request parsers
prisma/             Prisma schema and generated client
docs/
  api/openapi.yml   API contract
  db/               database schema reference
__test__/           unit and integration tests
```

See [`AGENTS.md`](AGENTS.md) for the full code map and the conventions used in this project.

## API

The HTTP API is documented in [`docs/api/openapi.yml`](docs/api/openapi.yml). All endpoints live under `/api`, return JSON, and use cookie-based auth. Errors share one shape:

```json
{ "error": { "code": "CONFLICT_NOT_FOUND", "message": "Conflict not found" } }
```

Conflicts are visible only to members of the same couple. Private messages are visible only to their author. Requests for another couple's data return `404`.

> [!WARNING]
> Bridge is not a crisis service or a replacement for therapy. If someone is in immediate danger, contact your local emergency number.
