import { beforeEach, describe, expect, it, vi } from "vitest";

import { summarizeThread } from "@/lib/ai/summarizer";
import { rewriteForPartner } from "@/lib/ai/partner-view";
import { prisma } from "@/lib/db/prisma";
import {
  approvePerspective,
  generatePartnerView,
  generateSummary,
  getPartnerPerspective,
  getPerspective,
  shareFeelings,
  updatePerspective,
} from "@/lib/services/perspective.service";
import {
  resetPrismaMock,
  type PrismaMock,
} from "../helpers/prisma-mock";

vi.mock("@/lib/ai/summarizer", () => ({
  summarizeThread: vi.fn(),
}));

vi.mock("@/lib/ai/partner-view", () => ({
  rewriteForPartner: vi.fn(),
}));

vi.mock("@/lib/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");

  return { prisma: createPrismaMock() };
});

const summarizerMock = vi.mocked(summarizeThread);
const partnerViewMock = vi.mocked(rewriteForPartner);
const db = prisma as unknown as PrismaMock;

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PARTNER_ID = "33333333-3333-4333-8333-333333333333";
const COUPLE_ID = "22222222-2222-4222-8222-222222222222";
const CONFLICT_ID = "44444444-4444-4444-8444-444444444444";
const CREATED_AT = new Date("2026-01-02T03:04:05.000Z");
const SHARED_AT = new Date("2026-01-03T04:05:06.000Z");

const conflictRow = {
  id: CONFLICT_ID,
  status: "collecting",
  couples: {
    users: [
      { id: USER_ID, display_name: "Ada" },
      { id: PARTNER_ID, display_name: "Grace" },
    ],
  },
};

const perspectiveRow = {
  summary: "I felt alone.",
  partner_view: "Ada felt alone.",
  feelings: null,
  approved_at: null,
  feelings_shared_at: null,
};

beforeEach(() => {
  resetPrismaMock(db);
  summarizerMock.mockResolvedValue({ summary: "I felt alone." });
  partnerViewMock.mockResolvedValue({ partnerView: "Ada felt alone." });
});

describe("perspective.service getPerspective", () => {
  it("treats a malformed id as not found", async () => {
    await expect(
      getPerspective("nope", COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND" });

    expect(db.conflicts.findFirst).not.toHaveBeenCalled();
  });

  it("treats a foreign conflict as not found", async () => {
    db.conflicts.findFirst.mockResolvedValue(null);

    await expect(
      getPerspective(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND" });
  });

  it("returns all-null fields when no perspective exists", async () => {
    db.conflicts.findFirst.mockResolvedValue({ id: CONFLICT_ID });
    db.perspectives.findUnique.mockResolvedValue(null);

    await expect(
      getPerspective(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).resolves.toEqual({
      summary: null,
      partnerView: null,
      feelings: null,
      approvedAt: null,
      feelingsSharedAt: null,
    });
  });

  it("maps a stored perspective to camelCase ISO timestamps", async () => {
    db.conflicts.findFirst.mockResolvedValue({ id: CONFLICT_ID });
    db.perspectives.findUnique.mockResolvedValue({
      ...perspectiveRow,
      feelings: "Relieved",
      approved_at: CREATED_AT,
      feelings_shared_at: SHARED_AT,
    });

    await expect(
      getPerspective(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).resolves.toEqual({
      summary: "I felt alone.",
      partnerView: "Ada felt alone.",
      feelings: "Relieved",
      approvedAt: CREATED_AT.toISOString(),
      feelingsSharedAt: SHARED_AT.toISOString(),
    });
  });
});

describe("perspective.service updatePerspective", () => {
  it("rejects edits after collecting ends", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      id: CONFLICT_ID,
      status: "feedback",
    });

    await expect(
      updatePerspective(CONFLICT_ID, COUPLE_ID, USER_ID, {
        summary: "New",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_STATE_TRANSITION",
      message: "Perspectives can only be edited while the conflict is collecting",
    });

    expect(db.perspectives.upsert).not.toHaveBeenCalled();
  });

  it("upserts the summary and invalidates consent", async () => {
    db.conflicts.findFirst.mockResolvedValue({ id: CONFLICT_ID, status: "collecting" });
    db.perspectives.upsert.mockResolvedValue({
      ...perspectiveRow,
      summary: "New summary",
      partner_view: null,
    });

    const result = await updatePerspective(CONFLICT_ID, COUPLE_ID, USER_ID, {
      summary: "New summary",
    });

    expect(db.perspectives.upsert).toHaveBeenCalledWith({
      where: {
        conflict_id_user_id: {
          conflict_id: CONFLICT_ID,
          user_id: USER_ID,
        },
      },
      create: {
        conflict_id: CONFLICT_ID,
        user_id: USER_ID,
        summary: "New summary",
      },
      update: {
        summary: "New summary",
        partner_view: null,
        approved_at: null,
      },
      select: expect.any(Object),
    });
    expect(result).toMatchObject({
      summary: "New summary",
      partnerView: null,
      approvedAt: null,
    });
  });
});

describe("perspective.service generateSummary", () => {
  it("requires at least one user message", async () => {
    db.conflicts.findFirst.mockResolvedValue(conflictRow);
    db.messages.findMany.mockResolvedValue([
      { role: "assistant", content: "Tell me more" },
    ]);

    await expect(
      generateSummary(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({
      code: "NOT_ENOUGH_CONTEXT",
      status: 409,
    });

    expect(summarizerMock).not.toHaveBeenCalled();
    expect(db.perspectives.upsert).not.toHaveBeenCalled();
  });

  it("summarises the caller's thread and clears consent", async () => {
    db.conflicts.findFirst.mockResolvedValue(conflictRow);
    db.messages.findMany.mockResolvedValue([
      { role: "user", content: "She ignored me" },
      { role: "assistant", content: "That sounds lonely" },
    ]);
    db.perspectives.upsert.mockResolvedValue({ id: "p" });

    const result = await generateSummary(CONFLICT_ID, COUPLE_ID, USER_ID);

    expect(summarizerMock).toHaveBeenCalledWith({
      participantName: "Ada",
      history: [
        { role: "user", content: "She ignored me" },
        { role: "assistant", content: "That sounds lonely" },
      ],
    });
    expect(db.perspectives.upsert).toHaveBeenCalledWith({
      where: {
        conflict_id_user_id: {
          conflict_id: CONFLICT_ID,
          user_id: USER_ID,
        },
      },
      create: {
        conflict_id: CONFLICT_ID,
        user_id: USER_ID,
        summary: "I felt alone.",
      },
      update: {
        summary: "I felt alone.",
        partner_view: null,
        approved_at: null,
      },
      select: { id: true },
    });
    expect(result).toEqual({ summary: "I felt alone." });
  });

  it("rejects a caller who is not a couple member", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      ...conflictRow,
      couples: { users: [{ id: PARTNER_ID, display_name: "Grace" }] },
    });

    await expect(
      generateSummary(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({ code: "ACTION_NOT_ALLOWED" });
  });

  it("rejects generation outside collecting", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      ...conflictRow,
      status: "feedback",
    });

    await expect(
      generateSummary(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({ code: "INVALID_STATE_TRANSITION" });
  });

  it("leaves the perspective untouched when the model fails", async () => {
    db.conflicts.findFirst.mockResolvedValue(conflictRow);
    db.messages.findMany.mockResolvedValue([
      { role: "user", content: "She ignored me" },
    ]);
    summarizerMock.mockRejectedValue(new Error("model down"));

    await expect(
      generateSummary(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).rejects.toThrow("model down");

    expect(db.perspectives.upsert).not.toHaveBeenCalled();
  });
});

describe("perspective.service generatePartnerView", () => {
  it("requires a non-blank summary", async () => {
    db.conflicts.findFirst.mockResolvedValue(conflictRow);
    db.perspectives.findUnique.mockResolvedValue({ summary: "   " });

    await expect(
      generatePartnerView(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({
      code: "SUMMARY_MISSING",
      message: "Generate or write a summary first",
    });

    expect(partnerViewMock).not.toHaveBeenCalled();
  });

  it("requires a stored perspective", async () => {
    db.conflicts.findFirst.mockResolvedValue(conflictRow);
    db.perspectives.findUnique.mockResolvedValue(null);

    await expect(
      generatePartnerView(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({ code: "SUMMARY_MISSING" });
  });

  it("rewrites the summary and clears any previous approval", async () => {
    db.conflicts.findFirst.mockResolvedValue(conflictRow);
    db.perspectives.findUnique.mockResolvedValue({
      summary: "  I felt alone.  ",
    });
    db.perspectives.update.mockResolvedValue({ id: "p" });

    const result = await generatePartnerView(CONFLICT_ID, COUPLE_ID, USER_ID);

    expect(partnerViewMock).toHaveBeenCalledWith({
      participantName: "Ada",
      summary: "I felt alone.",
    });
    expect(db.perspectives.update).toHaveBeenCalledWith({
      where: {
        conflict_id_user_id: {
          conflict_id: CONFLICT_ID,
          user_id: USER_ID,
        },
      },
      data: {
        partner_view: "Ada felt alone.",
        approved_at: null,
      },
      select: { id: true },
    });
    expect(result).toEqual({ partnerView: "Ada felt alone." });
  });

  it("rejects a caller who is not a couple member", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      ...conflictRow,
      couples: { users: [{ id: PARTNER_ID, display_name: "Grace" }] },
    });

    await expect(
      generatePartnerView(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({ code: "ACTION_NOT_ALLOWED" });
  });

  it("rejects generation outside collecting", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      ...conflictRow,
      status: "closed",
    });

    await expect(
      generatePartnerView(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({ code: "INVALID_STATE_TRANSITION" });
  });
});

describe("perspective.service approvePerspective", () => {
  beforeEach(() => {
    db.perspectives.update.mockResolvedValue({ id: "p" });
    db.conflicts.update.mockResolvedValue({ id: CONFLICT_ID });
  });

  it("treats a malformed id as not found", async () => {
    await expect(
      approvePerspective("nope", COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND" });

    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("treats a foreign or missing conflict as not found", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(
      approvePerspective(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND" });
  });

  it("rejects approval after the conflict is closed", async () => {
    db.$queryRaw.mockResolvedValue([{ status: "closed" }]);

    await expect(
      approvePerspective(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({
      code: "INVALID_STATE_TRANSITION",
      message: "Approval is not allowed after the conflict is closed",
    });
  });

  it("requires a generated partner view", async () => {
    db.$queryRaw.mockResolvedValue([{ status: "collecting" }]);
    db.perspectives.findUnique.mockResolvedValue({
      partner_view: "   ",
      approved_at: null,
    });

    await expect(
      approvePerspective(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({
      code: "PARTNER_VIEW_MISSING",
      message: "Generate a partner view first",
    });
  });

  it("returns an existing approval without rewriting it", async () => {
    db.$queryRaw.mockResolvedValue([{ status: "feedback" }]);
    db.perspectives.findUnique.mockResolvedValue({
      partner_view: "Ada felt alone.",
      approved_at: CREATED_AT,
    });

    await expect(
      approvePerspective(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).resolves.toEqual({
      approvedAt: CREATED_AT.toISOString(),
      conflictStatus: "feedback",
    });
    expect(db.perspectives.update).not.toHaveBeenCalled();
  });

  it("maps an existing approval on a collecting conflict", async () => {
    db.$queryRaw.mockResolvedValue([{ status: "collecting" }]);
    db.perspectives.findUnique.mockResolvedValue({
      partner_view: "Ada felt alone.",
      approved_at: CREATED_AT,
    });

    await expect(
      approvePerspective(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).resolves.toEqual({
      approvedAt: CREATED_AT.toISOString(),
      conflictStatus: "collecting",
    });
  });

  it("rejects a fresh approval outside collecting", async () => {
    db.$queryRaw.mockResolvedValue([{ status: "feedback" }]);
    db.perspectives.findUnique.mockResolvedValue({
      partner_view: "Ada felt alone.",
      approved_at: null,
    });

    await expect(
      approvePerspective(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({ code: "INVALID_STATE_TRANSITION" });
  });

  it("records the first approval and keeps collecting", async () => {
    db.$queryRaw.mockResolvedValue([{ status: "collecting" }]);
    db.perspectives.findUnique.mockResolvedValue({
      partner_view: "Ada felt alone.",
      approved_at: null,
    });
    db.perspectives.count.mockResolvedValue(1);

    const result = await approvePerspective(CONFLICT_ID, COUPLE_ID, USER_ID);

    expect(db.perspectives.update).toHaveBeenCalledWith({
      where: {
        conflict_id_user_id: {
          conflict_id: CONFLICT_ID,
          user_id: USER_ID,
        },
      },
      data: { approved_at: expect.any(Date) },
      select: { id: true },
    });
    expect(result.conflictStatus).toBe("collecting");
    expect(db.conflicts.update).not.toHaveBeenCalled();
  });

  it("moves the conflict to feedback after the second approval", async () => {
    db.$queryRaw.mockResolvedValue([{ status: "collecting" }]);
    db.perspectives.findUnique.mockResolvedValue({
      partner_view: "Ada felt alone.",
      approved_at: null,
    });
    db.perspectives.count.mockResolvedValue(2);

    const result = await approvePerspective(CONFLICT_ID, COUPLE_ID, USER_ID);

    expect(db.conflicts.update).toHaveBeenCalledWith({
      where: { id: CONFLICT_ID },
      data: { status: "feedback" },
      select: { id: true },
    });
    expect(result.conflictStatus).toBe("feedback");
  });
});

describe("perspective.service getPartnerPerspective", () => {
  it("treats a malformed id as not found", async () => {
    await expect(
      getPartnerPerspective("nope", COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND" });
  });

  it("is unavailable until both approvals are in", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      id: CONFLICT_ID,
      status: "collecting",
      couples: { users: [{ id: USER_ID }, { id: PARTNER_ID }] },
    });

    await expect(
      getPartnerPerspective(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).resolves.toEqual({ available: false });
    expect(db.perspectives.findUnique).not.toHaveBeenCalled();
  });

  it("is unavailable when there is no partner", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      id: CONFLICT_ID,
      status: "feedback",
      couples: { users: [{ id: USER_ID }] },
    });

    await expect(
      getPartnerPerspective(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).resolves.toEqual({ available: false });
  });

  it("is unavailable when the partner has not approved a view", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      id: CONFLICT_ID,
      status: "feedback",
      couples: { users: [{ id: USER_ID }, { id: PARTNER_ID }] },
    });
    db.perspectives.findUnique.mockResolvedValue({
      partner_view: "   ",
      approved_at: CREATED_AT,
      feelings: null,
      feelings_shared_at: null,
    });

    await expect(
      getPartnerPerspective(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).resolves.toEqual({ available: false });
  });

  it("returns the approved view without feelings until they are shared", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      id: CONFLICT_ID,
      status: "closed",
      couples: { users: [{ id: USER_ID }, { id: PARTNER_ID }] },
    });
    db.perspectives.findUnique.mockResolvedValue({
      partner_view: "Ada felt alone.",
      approved_at: CREATED_AT,
      feelings: "Relieved",
      feelings_shared_at: null,
    });

    await expect(
      getPartnerPerspective(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).resolves.toEqual({
      available: true,
      partnerView: "Ada felt alone.",
      approvedAt: CREATED_AT.toISOString(),
      feelings: null,
      feelingsSharedAt: null,
    });
  });

  it("returns feelings once they are shared", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      id: CONFLICT_ID,
      status: "feedback",
      couples: { users: [{ id: USER_ID }, { id: PARTNER_ID }] },
    });
    db.perspectives.findUnique.mockResolvedValue({
      partner_view: "Ada felt alone.",
      approved_at: CREATED_AT,
      feelings: "Relieved",
      feelings_shared_at: SHARED_AT,
    });

    await expect(
      getPartnerPerspective(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).resolves.toEqual({
      available: true,
      partnerView: "Ada felt alone.",
      approvedAt: CREATED_AT.toISOString(),
      feelings: "Relieved",
      feelingsSharedAt: SHARED_AT.toISOString(),
    });
  });

  it("hides blank feelings even after sharing", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      id: CONFLICT_ID,
      status: "feedback",
      couples: { users: [{ id: USER_ID }, { id: PARTNER_ID }] },
    });
    db.perspectives.findUnique.mockResolvedValue({
      partner_view: "Ada felt alone.",
      approved_at: CREATED_AT,
      feelings: "   ",
      feelings_shared_at: SHARED_AT,
    });

    const result = await getPartnerPerspective(
      CONFLICT_ID,
      COUPLE_ID,
      USER_ID,
    );

    expect(result).toMatchObject({
      available: true,
      feelings: null,
      feelingsSharedAt: null,
    });
  });
});

describe("perspective.service shareFeelings", () => {
  it("treats a malformed id as not found", async () => {
    await expect(
      shareFeelings("nope", COUPLE_ID, USER_ID, { feelings: "Relieved" }),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND" });
  });

  it("treats a foreign or missing conflict as not found", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(
      shareFeelings(CONFLICT_ID, COUPLE_ID, USER_ID, {
        feelings: "Relieved",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND" });
  });

  it("only allows sharing while in feedback", async () => {
    db.$queryRaw.mockResolvedValue([{ status: "collecting" }]);

    await expect(
      shareFeelings(CONFLICT_ID, COUPLE_ID, USER_ID, {
        feelings: "Relieved",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_STATE_TRANSITION",
      message: "Feelings can only be shared while status is feedback",
    });

    expect(db.perspectives.updateMany).not.toHaveBeenCalled();
  });

  it("requires an existing perspective row", async () => {
    db.$queryRaw.mockResolvedValue([{ status: "feedback" }]);
    db.perspectives.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      shareFeelings(CONFLICT_ID, COUPLE_ID, USER_ID, {
        feelings: "Relieved",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND" });
  });

  it("stores feelings and their timestamp", async () => {
    db.$queryRaw.mockResolvedValue([{ status: "feedback" }]);
    db.perspectives.updateMany.mockResolvedValue({ count: 1 });

    const result = await shareFeelings(CONFLICT_ID, COUPLE_ID, USER_ID, {
      feelings: "Relieved",
    });

    expect(db.perspectives.updateMany).toHaveBeenCalledWith({
      where: { conflict_id: CONFLICT_ID, user_id: USER_ID },
      data: {
        feelings: "Relieved",
        feelings_shared_at: expect.any(Date),
      },
    });
    expect(result.feelings).toBe("Relieved");
    expect(result.feelingsSharedAt).toEqual(expect.any(String));
  });
});
