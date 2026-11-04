import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/types/auth.types";
import type { Conflict, ConflictDetail } from "@/lib/types/conflict.types";
import type {
  ApproveResponse,
  PartnerPerspective,
  Perspective,
} from "@/lib/types/perspective.types";
import { startTestDatabase, type TestDatabase } from "../helpers/integration-db";
import {
  buildRequest,
  captureCookies,
  invoke,
  readJson,
  type CookieJar,
} from "../helpers/integration-harness";

const { mediatorMock, summarizerMock, partnerViewMock } = vi.hoisted(() => ({
  mediatorMock: vi.fn(),
  summarizerMock: vi.fn(),
  partnerViewMock: vi.fn(),
}));

vi.mock("@/lib/ai/mediator", () => ({
  completeMediatorTurn: mediatorMock,
}));

vi.mock("@/lib/ai/summarizer", () => ({
  summarizeThread: summarizerMock,
}));

vi.mock("@/lib/ai/partner-view", () => ({
  rewriteForPartner: partnerViewMock,
}));

type Routes = {
  register: typeof import("@/app/api/auth/register/route");
  conflicts: typeof import("@/app/api/conflicts/route");
  detail: typeof import("@/app/api/conflicts/[conflictId]/route");
  messages: typeof import("@/app/api/conflicts/[conflictId]/messages/route");
  perspective: typeof import("@/app/api/conflicts/[conflictId]/perspective/route");
  summaryGenerate: typeof import("@/app/api/conflicts/[conflictId]/perspective/summary/generate/route");
  partnerViewGenerate: typeof import("@/app/api/conflicts/[conflictId]/perspective/partner-view/generate/route");
  approve: typeof import("@/app/api/conflicts/[conflictId]/perspective/approve/route");
  partnerPerspective: typeof import("@/app/api/conflicts/[conflictId]/partner-perspective/route");
  feelings: typeof import("@/app/api/conflicts/[conflictId]/perspective/feelings/route");
};

type Prisma = typeof import("@/lib/db/prisma").prisma;

let db: TestDatabase;
let prisma: Prisma;
let routes: Routes;

const mediatorReply = {
  reply: "That sounds lonely.",
  readyToSummarize: true,
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

  return readJson<Conflict>(response);
}

async function postMessage(jar: CookieJar, conflictId: string) {
  const response = await invoke(
    routes.messages.POST,
    buildRequest("POST", `/api/conflicts/${conflictId}/messages`, {
      body: { content: "She ignored me" },
      jar,
    }),
    { conflictId },
  );

  expect(response.status).toBe(201);
}

async function putSummary(
  jar: CookieJar,
  conflictId: string,
  summary: string,
) {
  const response = await invoke(
    routes.perspective.PUT,
    buildRequest("PUT", `/api/conflicts/${conflictId}/perspective`, {
      body: { summary },
      jar,
    }),
    { conflictId },
  );

  return { response, body: await readJson<Perspective>(response) };
}

async function getPerspective(jar: CookieJar, conflictId: string) {
  const response = await invoke(
    routes.perspective.GET,
    buildRequest("GET", `/api/conflicts/${conflictId}/perspective`, { jar }),
    { conflictId },
  );

  return { response, body: await readJson<Perspective>(response) };
}

async function generateView(jar: CookieJar, conflictId: string) {
  const response = await invoke(
    routes.partnerViewGenerate.POST,
    buildRequest(
      "POST",
      `/api/conflicts/${conflictId}/perspective/partner-view/generate`,
      { jar },
    ),
    { conflictId },
  );

  return { response, body: await readJson<{ partnerView: string }>(response) };
}

async function approve(jar: CookieJar, conflictId: string) {
  const response = await invoke(
    routes.approve.POST,
    buildRequest(
      "POST",
      `/api/conflicts/${conflictId}/perspective/approve`,
      { jar },
    ),
    { conflictId },
  );

  return { response, body: await readJson<ApproveResponse>(response) };
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
    messages: await import("@/app/api/conflicts/[conflictId]/messages/route"),
    perspective: await import("@/app/api/conflicts/[conflictId]/perspective/route"),
    summaryGenerate: await import("@/app/api/conflicts/[conflictId]/perspective/summary/generate/route"),
    partnerViewGenerate: await import("@/app/api/conflicts/[conflictId]/perspective/partner-view/generate/route"),
    approve: await import("@/app/api/conflicts/[conflictId]/perspective/approve/route"),
    partnerPerspective: await import("@/app/api/conflicts/[conflictId]/partner-perspective/route"),
    feelings: await import("@/app/api/conflicts/[conflictId]/perspective/feelings/route"),
  };
});

beforeEach(async () => {
  await db.reset();
  mediatorMock.mockResolvedValue(mediatorReply);
  summarizerMock.mockImplementation(
    async ({ participantName }: { participantName: string }) => ({
      summary: `${participantName}'s summary`,
    }),
  );
  partnerViewMock.mockImplementation(
    async ({ participantName }: { participantName: string }) => ({
      partnerView: `${participantName}'s shared view`,
    }),
  );
});

afterAll(async () => {
  await prisma?.$disconnect();
  await db?.stop();
});

describe("GET/PUT /api/conflicts/:conflictId/perspective", () => {
  it("returns all-null fields before anything is written", async () => {
    const { jarA } = await createCouple();
    const conflict = await createConflict(jarA);

    const { response, body } = await getPerspective(jarA, conflict.id);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      summary: null,
      partnerView: null,
      feelings: null,
      approvedAt: null,
      feelingsSharedAt: null,
    });
  });

  it("stores a hand-written summary", async () => {
    const { jarA } = await createCouple();
    const conflict = await createConflict(jarA);

    const { response, body } = await putSummary(
      jarA,
      conflict.id,
      "I felt alone.",
    );

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ summary: "I felt alone.", partnerView: null });

    const stored = await getPerspective(jarA, conflict.id);
    expect(stored.body.summary).toBe("I felt alone.");

    const row = await prisma.perspectives.findFirst({
      where: { conflict_id: conflict.id },
    });
    expect(row?.summary).toBe("I felt alone.");
  });

  it("rejects edits once the conflict is in feedback", async () => {
    const { jarA } = await createCouple();
    const conflict = await createConflict(jarA);
    await db.query("UPDATE conflicts SET status = 'feedback' WHERE id = $1", [
      conflict.id,
    ]);

    const { response, body } = await putSummary(jarA, conflict.id, "Too late");

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: { code: "INVALID_STATE_TRANSITION" },
    });
  });

  it("returns 404 for a malformed id", async () => {
    const { jarA } = await createCouple();
    const conflictId = "not-a-uuid";

    const response = await invoke(
      routes.perspective.GET,
      buildRequest("GET", `/api/conflicts/${conflictId}/perspective`, {
        jar: jarA,
      }),
      { conflictId },
    );

    expect(response.status).toBe(404);
  });
});

describe("POST /api/conflicts/:conflictId/perspective/summary/generate", () => {
  it("requires at least one user message", async () => {
    const { jarA } = await createCouple();
    const conflict = await createConflict(jarA);

    const response = await invoke(
      routes.summaryGenerate.POST,
      buildRequest(
        "POST",
        `/api/conflicts/${conflict.id}/perspective/summary/generate`,
        { jar: jarA },
      ),
      { conflictId: conflict.id },
    );

    expect(response.status).toBe(409);
    await expect(readJson(response)).resolves.toMatchObject({
      error: { code: "NOT_ENOUGH_CONTEXT" },
    });
    expect(summarizerMock).not.toHaveBeenCalled();
  });

  it("generates and stores a summary from the private thread", async () => {
    const { a, jarA } = await createCouple();
    const conflict = await createConflict(jarA);
    await postMessage(jarA, conflict.id);

    const response = await invoke(
      routes.summaryGenerate.POST,
      buildRequest(
        "POST",
        `/api/conflicts/${conflict.id}/perspective/summary/generate`,
        { jar: jarA },
      ),
      { conflictId: conflict.id },
    );
    const body = await readJson<{ summary: string }>(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({ summary: "Ada's summary" });
    expect(summarizerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        participantName: a.session.user.displayName,
        history: expect.arrayContaining([
          { role: "user", content: "She ignored me" },
          { role: "assistant", content: mediatorReply.reply },
        ]),
      }),
    );

    const stored = await getPerspective(jarA, conflict.id);
    expect(stored.body.summary).toBe("Ada's summary");
  });

  it("clears the partner view and approval when regenerating", async () => {
    const { jarA } = await createCouple();
    const conflict = await createConflict(jarA);
    await postMessage(jarA, conflict.id);
    await putSummary(jarA, conflict.id, "Old summary");
    await generateView(jarA, conflict.id);
    await db.query(
      "UPDATE perspectives SET approved_at = now() WHERE conflict_id = $1",
      [conflict.id],
    );

    const response = await invoke(
      routes.summaryGenerate.POST,
      buildRequest(
        "POST",
        `/api/conflicts/${conflict.id}/perspective/summary/generate`,
        { jar: jarA },
      ),
      { conflictId: conflict.id },
    );

    expect(response.status).toBe(200);
    const stored = await getPerspective(jarA, conflict.id);
    expect(stored.body).toMatchObject({
      summary: "Ada's summary",
      partnerView: null,
      approvedAt: null,
    });
  });
});

describe("POST /api/conflicts/:conflictId/perspective/partner-view/generate", () => {
  it("requires a summary first", async () => {
    const { jarA } = await createCouple();
    const conflict = await createConflict(jarA);

    const { response, body } = await generateView(jarA, conflict.id);

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: { code: "SUMMARY_MISSING" },
    });
    expect(partnerViewMock).not.toHaveBeenCalled();
  });

  it("reframes the summary for the partner", async () => {
    const { jarA } = await createCouple();
    const conflict = await createConflict(jarA);
    await putSummary(jarA, conflict.id, "I felt alone.");

    const { response, body } = await generateView(jarA, conflict.id);

    expect(response.status).toBe(200);
    expect(body).toEqual({ partnerView: "Ada's shared view" });
    expect(partnerViewMock).toHaveBeenCalledWith({
      participantName: "Ada",
      summary: "I felt alone.",
    });

    const stored = await getPerspective(jarA, conflict.id);
    expect(stored.body.partnerView).toBe("Ada's shared view");
  });
});

describe("POST /api/conflicts/:conflictId/perspective/approve", () => {
  it("requires a generated partner view", async () => {
    const { jarA } = await createCouple();
    const conflict = await createConflict(jarA);
    await putSummary(jarA, conflict.id, "I felt alone.");

    const { response, body } = await approve(jarA, conflict.id);

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: { code: "PARTNER_VIEW_MISSING" },
    });
  });

  it("moves to feedback only after both partners approve", async () => {
    const { jarA, jarB } = await createCouple();
    const conflict = await createConflict(jarA);
    await putSummary(jarA, conflict.id, "Ada's side");
    await generateView(jarA, conflict.id);
    await putSummary(jarB, conflict.id, "Grace's side");
    await generateView(jarB, conflict.id);

    const first = await approve(jarA, conflict.id);
    expect(first.response.status).toBe(200);
    expect(first.body.conflictStatus).toBe("collecting");

    const second = await approve(jarB, conflict.id);
    expect(second.response.status).toBe(200);
    expect(second.body.conflictStatus).toBe("feedback");

    const detail = await invoke(
      routes.detail.GET,
      buildRequest("GET", `/api/conflicts/${conflict.id}`, { jar: jarA }),
      { conflictId: conflict.id },
    );
    await expect(readJson<ConflictDetail>(detail)).resolves.toMatchObject({
      status: "feedback",
    });

    const idempotent = await approve(jarA, conflict.id);
    expect(idempotent.response.status).toBe(200);
    expect(idempotent.body.conflictStatus).toBe("feedback");
  });
});

describe("GET /api/conflicts/:conflictId/partner-perspective", () => {
  it("is unavailable before feedback", async () => {
    const { jarA, jarB } = await createCouple();
    const conflict = await createConflict(jarA);
    await putSummary(jarA, conflict.id, "Ada's side");
    await generateView(jarA, conflict.id);
    await putSummary(jarB, conflict.id, "Grace's side");
    await generateView(jarB, conflict.id);
    await approve(jarA, conflict.id);

    const response = await invoke(
      routes.partnerPerspective.GET,
      buildRequest(
        "GET",
        `/api/conflicts/${conflict.id}/partner-perspective`,
        { jar: jarA },
      ),
      { conflictId: conflict.id },
    );

    await expect(readJson<PartnerPerspective>(response)).resolves.toEqual({
      available: false,
    });
  });

  it("returns only the approved partner view, never the summary", async () => {
    const { jarA, jarB } = await createCouple();
    const conflict = await createConflict(jarA);
    await putSummary(jarA, conflict.id, "Ada's private summary");
    await generateView(jarA, conflict.id);
    await putSummary(jarB, conflict.id, "Grace's private summary");
    await generateView(jarB, conflict.id);
    await approve(jarA, conflict.id);
    await approve(jarB, conflict.id);

    const response = await invoke(
      routes.partnerPerspective.GET,
      buildRequest(
        "GET",
        `/api/conflicts/${conflict.id}/partner-perspective`,
        { jar: jarA },
      ),
      { conflictId: conflict.id },
    );
    const body = await readJson<PartnerPerspective>(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      available: true,
      partnerView: "Grace's shared view",
      feelings: null,
      feelingsSharedAt: null,
    });
    expect(JSON.stringify(body)).not.toContain("private summary");
  });
});

describe("POST /api/conflicts/:conflictId/perspective/feelings", () => {
  it("only allows sharing while in feedback", async () => {
    const { jarA } = await createCouple();
    const conflict = await createConflict(jarA);

    const response = await invoke(
      routes.feelings.POST,
      buildRequest(
        "POST",
        `/api/conflicts/${conflict.id}/perspective/feelings`,
        { body: { feelings: "Relieved" }, jar: jarA },
      ),
      { conflictId: conflict.id },
    );

    expect(response.status).toBe(409);
    await expect(readJson(response)).resolves.toMatchObject({
      error: { code: "INVALID_STATE_TRANSITION" },
    });
  });

  it("shares feelings with the partner only after they are submitted", async () => {
    const { jarA, jarB } = await createCouple();
    const conflict = await createConflict(jarA);
    await putSummary(jarA, conflict.id, "Ada's side");
    await generateView(jarA, conflict.id);
    await putSummary(jarB, conflict.id, "Grace's side");
    await generateView(jarB, conflict.id);
    await approve(jarA, conflict.id);
    await approve(jarB, conflict.id);

    const before = await invoke(
      routes.partnerPerspective.GET,
      buildRequest(
        "GET",
        `/api/conflicts/${conflict.id}/partner-perspective`,
        { jar: jarA },
      ),
      { conflictId: conflict.id },
    );
    await expect(readJson<PartnerPerspective>(before)).resolves.toMatchObject({
      available: true,
      feelings: null,
    });

    const share = await invoke(
      routes.feelings.POST,
      buildRequest(
        "POST",
        `/api/conflicts/${conflict.id}/perspective/feelings`,
        { body: { feelings: "Relieved and hopeful" }, jar: jarB },
      ),
      { conflictId: conflict.id },
    );
    const shared = await readJson<{
      feelings: string;
      feelingsSharedAt: string;
    }>(share);

    expect(share.status).toBe(200);
    expect(shared.feelings).toBe("Relieved and hopeful");
    expect(shared.feelingsSharedAt).toEqual(expect.any(String));

    const after = await invoke(
      routes.partnerPerspective.GET,
      buildRequest(
        "GET",
        `/api/conflicts/${conflict.id}/partner-perspective`,
        { jar: jarA },
      ),
      { conflictId: conflict.id },
    );
    const body = await readJson<PartnerPerspective>(after);

    expect(body).toMatchObject({
      available: true,
      feelings: "Relieved and hopeful",
      feelingsSharedAt: shared.feelingsSharedAt,
    });

    const reverse = await invoke(
      routes.partnerPerspective.GET,
      buildRequest(
        "GET",
        `/api/conflicts/${conflict.id}/partner-perspective`,
        { jar: jarB },
      ),
      { conflictId: conflict.id },
    );
    await expect(readJson<PartnerPerspective>(reverse)).resolves.toMatchObject({
      available: true,
      feelings: null,
    });
  });
});

describe("cross-couple isolation", () => {
  it("returns 404 for perspective routes on another couple's conflict", async () => {
    const first = await createCouple("first");
    const second = await createCouple("second");
    const conflict = await createConflict(first.jarA);

    const requests = [
      invoke(
        routes.perspective.GET,
        buildRequest("GET", `/api/conflicts/${conflict.id}/perspective`, {
          jar: second.jarA,
        }),
        { conflictId: conflict.id },
      ),
      invoke(
        routes.perspective.PUT,
        buildRequest("PUT", `/api/conflicts/${conflict.id}/perspective`, {
          body: { summary: "Intruder" },
          jar: second.jarA,
        }),
        { conflictId: conflict.id },
      ),
      invoke(
        routes.summaryGenerate.POST,
        buildRequest(
          "POST",
          `/api/conflicts/${conflict.id}/perspective/summary/generate`,
          { jar: second.jarA },
        ),
        { conflictId: conflict.id },
      ),
      invoke(
        routes.approve.POST,
        buildRequest(
          "POST",
          `/api/conflicts/${conflict.id}/perspective/approve`,
          { jar: second.jarA },
        ),
        { conflictId: conflict.id },
      ),
      invoke(
        routes.partnerPerspective.GET,
        buildRequest(
          "GET",
          `/api/conflicts/${conflict.id}/partner-perspective`,
          { jar: second.jarA },
        ),
        { conflictId: conflict.id },
      ),
      invoke(
        routes.feelings.POST,
        buildRequest(
          "POST",
          `/api/conflicts/${conflict.id}/perspective/feelings`,
          { body: { feelings: "Intruder" }, jar: second.jarA },
        ),
        { conflictId: conflict.id },
      ),
    ];

    for (const response of await Promise.all(requests)) {
      expect(response.status).toBe(404);
    }
  });
});
