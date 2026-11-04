import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/types/auth.types";
import type { Conflict, ConflictDetail } from "@/lib/types/conflict.types";
import type { MessageList, SendMessageResult } from "@/lib/types/message.types";
import { startTestDatabase, type TestDatabase } from "../helpers/integration-db";
import {
  buildRequest,
  captureCookies,
  invoke,
  readJson,
  type CookieJar,
} from "../helpers/integration-harness";

const { mediatorMock } = vi.hoisted(() => ({
  mediatorMock: vi.fn(),
}));

vi.mock("@/lib/ai/mediator", () => ({
  completeMediatorTurn: mediatorMock,
}));

type Routes = {
  register: typeof import("@/app/api/auth/register/route");
  conflicts: typeof import("@/app/api/conflicts/route");
  detail: typeof import("@/app/api/conflicts/[conflictId]/route");
  close: typeof import("@/app/api/conflicts/[conflictId]/close/route");
  messages: typeof import("@/app/api/conflicts/[conflictId]/messages/route");
};

type Prisma = typeof import("@/lib/db/prisma").prisma;

let db: TestDatabase;
let prisma: Prisma;
let routes: Routes;

const reply = {
  reply: "It sounds like the silence felt personal.",
  readyToSummarize: false,
  detected: { facts: [], emotions: [], needs: [] },
  safetyFlag: false,
};

function email(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

async function registerUser(options: {
  displayName: string;
  email: string;
  inviteCode?: string;
  jar?: CookieJar;
}) {
  const jar = options.jar ?? {};
  const response = await invoke(
    routes.register.POST,
    buildRequest("POST", "/api/auth/register", {
      body: {
        displayName: options.displayName,
        email: options.email,
        password: "supersecret",
        inviteCode: options.inviteCode,
      },
      jar,
    }),
    {},
  );
  const session = await readJson<AuthSession>(response);
  captureCookies(response, jar);

  return { response, session, jar };
}

async function createCouple(prefix = "couple") {
  const jarA: CookieJar = {};
  const jarB: CookieJar = {};
  const a = await registerUser({
    displayName: "Ada",
    email: email(`${prefix}-a`),
    jar: jarA,
  });
  const b = await registerUser({
    displayName: "Grace",
    email: email(`${prefix}-b`),
    inviteCode: a.session.couple.inviteCode,
    jar: jarB,
  });

  return { a, b, jarA, jarB };
}

async function createConflict(jar: CookieJar, title = "The dishes") {
  const response = await invoke(
    routes.conflicts.POST,
    buildRequest("POST", "/api/conflicts", { body: { title }, jar }),
    {},
  );
  const conflict = await readJson<Conflict>(response);

  return { response, conflict };
}

async function postMessage(
  jar: CookieJar,
  conflictId: string,
  content = "She ignored me",
) {
  const response = await invoke(
    routes.messages.POST,
    buildRequest("POST", `/api/conflicts/${conflictId}/messages`, {
      body: { content },
      jar,
    }),
    { conflictId },
  );

  return { response, body: await readJson<SendMessageResult>(response) };
}

beforeAll(async () => {
  db = await startTestDatabase();
  process.env.DATABASE_URL = db.connectionUri;
  process.env.JWT_SECRET = "integration-test-secret-value-32chars";

  vi.resetModules();

  prisma = (await import("@/lib/db/prisma")).prisma;
  routes = {
    register: await import("@/app/api/auth/register/route"),
    conflicts: await import("@/app/api/conflicts/route"),
    detail: await import("@/app/api/conflicts/[conflictId]/route"),
    close: await import("@/app/api/conflicts/[conflictId]/close/route"),
    messages: await import("@/app/api/conflicts/[conflictId]/messages/route"),
  };
});

beforeEach(async () => {
  await db.reset();
  mediatorMock.mockResolvedValue(reply);
});

afterAll(async () => {
  await prisma?.$disconnect();
  await db?.stop();
});

describe("POST /api/conflicts", () => {
  it("requires the partner to have joined", async () => {
    const alone = await registerUser({
      displayName: "Ada",
      email: email("alone"),
    });

    const response = await invoke(
      routes.conflicts.POST,
      buildRequest("POST", "/api/conflicts", {
        body: { title: "The dishes" },
        jar: alone.jar,
      }),
      {},
    );

    expect(response.status).toBe(403);
    await expect(readJson(response)).resolves.toMatchObject({
      error: { code: "PARTNER_NOT_JOINED" },
    });
  });

  it("creates a conflict for a complete couple", async () => {
    const { a, jarA } = await createCouple();

    const { response, conflict } = await createConflict(jarA);

    expect(response.status).toBe(201);
    expect(conflict).toMatchObject({
      title: "The dishes",
      status: "collecting",
      outcome: null,
      flagged: false,
      createdBy: a.session.user.id,
      closedAt: null,
    });

    const row = await prisma.conflicts.findUnique({
      where: { id: conflict.id },
    });
    expect(row?.couple_id).toBe(a.session.couple.id);
  });

  it("rejects an empty title", async () => {
    const { jarA } = await createCouple();

    const response = await invoke(
      routes.conflicts.POST,
      buildRequest("POST", "/api/conflicts", {
        body: { title: "   " },
        jar: jarA,
      }),
      {},
    );

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fields: { title: "Title is required" },
      },
    });
  });

  it("requires authentication", async () => {
    const response = await invoke(
      routes.conflicts.POST,
      buildRequest("POST", "/api/conflicts", { body: { title: "Hi" } }),
      {},
    );

    expect(response.status).toBe(401);
  });
});

describe("GET /api/conflicts", () => {
  it("lists the couple's conflicts newest first", async () => {
    const { jarA } = await createCouple();
    const older = await createConflict(jarA, "Older");
    await db.query(
      "UPDATE conflicts SET created_at = '2020-01-01T00:00:00Z' WHERE id = $1",
      [older.conflict.id],
    );
    await createConflict(jarA, "Newer");

    const response = await invoke(
      routes.conflicts.GET,
      buildRequest("GET", "/api/conflicts", { jar: jarA }),
      {},
    );
    const body = await readJson<{ items: Conflict[] }>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.items.map((item) => item.title)).toEqual(["Newer", "Older"]);
  });

  it("does not list another couple's conflicts", async () => {
    const first = await createCouple("first");
    const second = await createCouple("second");
    await createConflict(first.jarA, "Private");

    const response = await invoke(
      routes.conflicts.GET,
      buildRequest("GET", "/api/conflicts", { jar: second.jarA }),
      {},
    );

    await expect(readJson<{ items: Conflict[] }>(response)).resolves.toEqual({
      items: [],
    });
  });
});

describe("GET /api/conflicts/:conflictId", () => {
  it("returns progress without private content", async () => {
    const { jarA, jarB } = await createCouple();
    const { conflict } = await createConflict(jarA);

    const response = await invoke(
      routes.detail.GET,
      buildRequest("GET", `/api/conflicts/${conflict.id}`, { jar: jarA }),
      { conflictId: conflict.id },
    );
    const body = await readJson<ConflictDetail>(response);

    expect(response.status).toBe(200);
    expect(body.progress).toEqual({
      me: { hasSummary: false, approved: false, feelingsShared: false },
      partner: { hasSummary: false, approved: false, feelingsShared: false },
    });
    expect(JSON.stringify(body)).not.toContain("summary");

    const partnerResponse = await invoke(
      routes.detail.GET,
      buildRequest("GET", `/api/conflicts/${conflict.id}`, { jar: jarB }),
      { conflictId: conflict.id },
    );
    expect(partnerResponse.status).toBe(200);
  });

  it("treats a malformed id as not found", async () => {
    const { jarA } = await createCouple();

    const response = await invoke(
      routes.detail.GET,
      buildRequest("GET", "/api/conflicts/not-a-uuid", { jar: jarA }),
      { conflictId: "not-a-uuid" },
    );

    expect(response.status).toBe(404);
  });

  it("hides a conflict from another couple", async () => {
    const first = await createCouple("first");
    const second = await createCouple("second");
    const { conflict } = await createConflict(first.jarA);

    const response = await invoke(
      routes.detail.GET,
      buildRequest("GET", `/api/conflicts/${conflict.id}`, {
        jar: second.jarA,
      }),
      { conflictId: conflict.id },
    );

    expect(response.status).toBe(404);
    await expect(readJson(response)).resolves.toMatchObject({
      error: { code: "CONFLICT_NOT_FOUND" },
    });
  });
});

describe("POST /api/conflicts/:conflictId/close", () => {
  it("rejects closing a collecting conflict", async () => {
    const { jarA } = await createCouple();
    const { conflict } = await createConflict(jarA);

    const response = await invoke(
      routes.close.POST,
      buildRequest("POST", `/api/conflicts/${conflict.id}/close`, {
        body: { outcome: "resolved" },
        jar: jarA,
      }),
      { conflictId: conflict.id },
    );

    expect(response.status).toBe(409);
    await expect(readJson(response)).resolves.toMatchObject({
      error: { code: "INVALID_STATE_TRANSITION" },
    });
  });

  it("returns not found for an unknown conflict", async () => {
    const { jarA } = await createCouple();
    const conflictId = randomUUID();

    const response = await invoke(
      routes.close.POST,
      buildRequest("POST", `/api/conflicts/${conflictId}/close`, {
        body: { outcome: "later" },
        jar: jarA,
      }),
      { conflictId },
    );

    expect(response.status).toBe(404);
  });

  it("closes a feedback conflict and records the outcome", async () => {
    const { jarA } = await createCouple();
    const { conflict } = await createConflict(jarA);
    await db.query("UPDATE conflicts SET status = 'feedback' WHERE id = $1", [
      conflict.id,
    ]);

    const response = await invoke(
      routes.close.POST,
      buildRequest("POST", `/api/conflicts/${conflict.id}/close`, {
        body: { outcome: "resolved" },
        jar: jarA,
      }),
      { conflictId: conflict.id },
    );
    const body = await readJson<Conflict>(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "closed", outcome: "resolved" });
    expect(body.closedAt).toEqual(expect.any(String));

    const again = await invoke(
      routes.close.POST,
      buildRequest("POST", `/api/conflicts/${conflict.id}/close`, {
        body: { outcome: "later" },
        jar: jarA,
      }),
      { conflictId: conflict.id },
    );

    expect(again.status).toBe(409);
  });
});

describe("GET/POST /api/conflicts/:conflictId/messages", () => {
  it("starts with an empty private thread", async () => {
    const { jarA } = await createCouple();
    const { conflict } = await createConflict(jarA);

    const response = await invoke(
      routes.messages.GET,
      buildRequest("GET", `/api/conflicts/${conflict.id}/messages`, {
        jar: jarA,
      }),
      { conflictId: conflict.id },
    );

    await expect(readJson<MessageList>(response)).resolves.toEqual({
      items: [],
    });
  });

  it("stores the user message and the mediator reply", async () => {
    const { a, jarA } = await createCouple();
    const { conflict } = await createConflict(jarA);

    const { response, body } = await postMessage(
      jarA,
      conflict.id,
      "She ignored me",
    );

    expect(response.status).toBe(201);
    expect(body.userMessage).toMatchObject({
      role: "user",
      content: "She ignored me",
    });
    expect(body.assistantMessage).toMatchObject({
      role: "assistant",
      content: reply.reply,
    });
    expect(body.safetyNotice).toBeNull();
    expect(mediatorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        participantName: "Ada",
        otherName: "Grace",
        content: "She ignored me",
      }),
    );

    const rows = await prisma.messages.findMany({
      where: { conflict_id: conflict.id },
      orderBy: { id: "asc" },
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.role)).toEqual(["user", "assistant"]);
    expect(rows.every((row) => row.user_id === a.session.user.id)).toBe(true);
  });

  it("keeps each partner's thread private", async () => {
    const { jarA, jarB } = await createCouple();
    const { conflict } = await createConflict(jarA);
    await postMessage(jarA, conflict.id);

    const partnerResponse = await invoke(
      routes.messages.GET,
      buildRequest("GET", `/api/conflicts/${conflict.id}/messages`, {
        jar: jarB,
      }),
      { conflictId: conflict.id },
    );

    await expect(readJson<MessageList>(partnerResponse)).resolves.toEqual({
      items: [],
    });
  });

  it("passes the existing history back to the mediator", async () => {
    const { jarA } = await createCouple();
    const { conflict } = await createConflict(jarA);
    await postMessage(jarA, conflict.id, "First");
    await postMessage(jarA, conflict.id, "Second");

    const lastCall = mediatorMock.mock.calls.at(-1)?.[0];

    expect(lastCall.history).toEqual([
      { role: "user", content: "First" },
      { role: "assistant", content: reply.reply },
    ]);
    expect(lastCall.content).toBe("Second");
  });

  it("flags the conflict and returns a safety notice", async () => {
    const { jarA } = await createCouple();
    const { conflict } = await createConflict(jarA);
    mediatorMock.mockResolvedValue({
      ...reply,
      reply: "I'm concerned about your safety.",
      safetyFlag: true,
    });

    const { response, body } = await postMessage(jarA, conflict.id);

    expect(response.status).toBe(201);
    expect(body.safetyNotice).toEqual({
      message: expect.stringContaining("Your safety matters"),
    });

    const row = await prisma.conflicts.findUnique({
      where: { id: conflict.id },
    });
    expect(row?.flagged).toBe(true);
  });

  it("rejects messages once collecting has ended", async () => {
    const { jarA } = await createCouple();
    const { conflict } = await createConflict(jarA);
    await db.query("UPDATE conflicts SET status = 'feedback' WHERE id = $1", [
      conflict.id,
    ]);

    const { response, body } = await postMessage(jarA, conflict.id);

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: { code: "INVALID_STATE_TRANSITION" },
    });
  });

  it("rejects a blank message", async () => {
    const { jarA } = await createCouple();
    const { conflict } = await createConflict(jarA);

    const response = await invoke(
      routes.messages.POST,
      buildRequest("POST", `/api/conflicts/${conflict.id}/messages`, {
        body: { content: "   " },
        jar: jarA,
      }),
      { conflictId: conflict.id },
    );

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toMatchObject({
      error: { fields: { content: "Message is required" } },
    });
  });

  it("hides another couple's thread", async () => {
    const first = await createCouple("first");
    const second = await createCouple("second");
    const { conflict } = await createConflict(first.jarA);

    const getResponse = await invoke(
      routes.messages.GET,
      buildRequest("GET", `/api/conflicts/${conflict.id}/messages`, {
        jar: second.jarA,
      }),
      { conflictId: conflict.id },
    );
    const postResponse = await invoke(
      routes.messages.POST,
      buildRequest("POST", `/api/conflicts/${conflict.id}/messages`, {
        body: { content: "Hi" },
        jar: second.jarA,
      }),
      { conflictId: conflict.id },
    );

    expect(getResponse.status).toBe(404);
    expect(postResponse.status).toBe(404);
  });

  it("returns 500 and stores nothing when the model fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { jarA } = await createCouple();
    const { conflict } = await createConflict(jarA);
    mediatorMock.mockRejectedValue(new Error("model unavailable"));

    const { response, body } = await postMessage(jarA, conflict.id);

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      error: { code: "INTERNAL_ERROR" },
    });
    expect(
      await prisma.messages.count({ where: { conflict_id: conflict.id } }),
    ).toBe(0);

    errorSpy.mockRestore();
  });
});
