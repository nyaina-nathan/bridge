import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
  closeConflict,
  createConflict,
  getConflictDetail,
  listConflicts,
} from "@/lib/services/conflict.service";
import {
  resetPrismaMock,
  type PrismaMock,
} from "../helpers/prisma-mock";

vi.mock("@/lib/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");

  return { prisma: createPrismaMock() };
});

const db = prisma as unknown as PrismaMock;

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PARTNER_ID = "33333333-3333-4333-8333-333333333333";
const COUPLE_ID = "22222222-2222-4222-8222-222222222222";
const CONFLICT_ID = "44444444-4444-4444-8444-444444444444";
const CREATED_AT = new Date("2026-01-02T03:04:05.000Z");
const CLOSED_AT = new Date("2026-01-03T04:05:06.000Z");

const conflictRow = {
  id: CONFLICT_ID,
  title: "The dishes",
  status: "collecting",
  outcome: null,
  flagged: false,
  created_by: USER_ID,
  created_at: CREATED_AT,
  closed_at: null,
};

beforeEach(() => {
  resetPrismaMock(db);
});

describe("conflict.service createConflict", () => {
  it("requires the partner to have joined", async () => {
    db.users.count.mockResolvedValue(1);

    await expect(
      createConflict(COUPLE_ID, USER_ID, { title: "The dishes" }),
    ).rejects.toMatchObject({ code: "PARTNER_NOT_JOINED", status: 403 });

    expect(db.conflicts.create).not.toHaveBeenCalled();
  });

  it("creates the conflict and maps it to camelCase", async () => {
    db.users.count.mockResolvedValue(2);
    db.conflicts.create.mockResolvedValue(conflictRow);

    const result = await createConflict(COUPLE_ID, USER_ID, {
      title: "The dishes",
    });

    expect(db.users.count).toHaveBeenCalledWith({
      where: { couple_id: COUPLE_ID },
    });
    expect(db.conflicts.create).toHaveBeenCalledWith({
      data: {
        couple_id: COUPLE_ID,
        created_by: USER_ID,
        title: "The dishes",
      },
      select: expect.any(Object),
    });
    expect(result).toEqual({
      id: CONFLICT_ID,
      title: "The dishes",
      status: "collecting",
      outcome: null,
      flagged: false,
      createdBy: USER_ID,
      createdAt: CREATED_AT.toISOString(),
      closedAt: null,
    });
  });
});

describe("conflict.service listConflicts", () => {
  it("lists only the couple's conflicts, newest first", async () => {
    db.conflicts.findMany.mockResolvedValue([
      {
        id: CONFLICT_ID,
        title: "The dishes",
        status: "closed",
        outcome: "resolved",
        created_at: CREATED_AT,
        closed_at: CLOSED_AT,
      },
    ]);

    const result = await listConflicts(COUPLE_ID);

    expect(db.conflicts.findMany).toHaveBeenCalledWith({
      where: { couple_id: COUPLE_ID },
      orderBy: { created_at: "desc" },
      select: expect.any(Object),
    });
    expect(result).toEqual({
      items: [
        {
          id: CONFLICT_ID,
          title: "The dishes",
          status: "closed",
          outcome: "resolved",
          createdAt: CREATED_AT.toISOString(),
          closedAt: CLOSED_AT.toISOString(),
        },
      ],
    });
  });

  it("returns an empty list when there are no conflicts", async () => {
    db.conflicts.findMany.mockResolvedValue([]);

    await expect(listConflicts(COUPLE_ID)).resolves.toEqual({ items: [] });
  });
});

describe("conflict.service getConflictDetail", () => {
  it("treats a malformed id as not found without querying", async () => {
    await expect(
      getConflictDetail("not-a-uuid", COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND", status: 404 });

    expect(db.conflicts.findFirst).not.toHaveBeenCalled();
  });

  it("treats a foreign or missing conflict as not found", async () => {
    db.conflicts.findFirst.mockResolvedValue(null);

    await expect(
      getConflictDetail(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND" });

    expect(db.conflicts.findFirst).toHaveBeenCalledWith({
      where: { id: CONFLICT_ID, couple_id: COUPLE_ID },
      select: expect.any(Object),
    });
  });

  it("computes progress for both members without leaking content", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      ...conflictRow,
      perspectives: [
        {
          user_id: USER_ID,
          summary: "My side",
          approved_at: CREATED_AT,
          feelings_shared_at: null,
        },
        {
          user_id: PARTNER_ID,
          summary: null,
          approved_at: null,
          feelings_shared_at: CLOSED_AT,
        },
      ],
      couples: {
        users: [{ id: USER_ID }, { id: PARTNER_ID }],
      },
    });

    const result = await getConflictDetail(CONFLICT_ID, COUPLE_ID, USER_ID);

    expect(result.progress).toEqual({
      me: { hasSummary: true, approved: true, feelingsShared: false },
      partner: { hasSummary: false, approved: false, feelingsShared: true },
    });
    expect(result).not.toHaveProperty("perspectives");
    expect(result).not.toHaveProperty("couples");
  });

  it("defaults partner progress when the partner has no perspective", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      ...conflictRow,
      perspectives: [],
      couples: { users: [{ id: USER_ID }, { id: PARTNER_ID }] },
    });

    const result = await getConflictDetail(CONFLICT_ID, COUPLE_ID, USER_ID);

    expect(result.progress).toEqual({
      me: { hasSummary: false, approved: false, feelingsShared: false },
      partner: { hasSummary: false, approved: false, feelingsShared: false },
    });
  });

  it("defaults partner progress when there is no partner", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      ...conflictRow,
      perspectives: [
        {
          user_id: USER_ID,
          summary: null,
          approved_at: null,
          feelings_shared_at: null,
        },
      ],
      couples: { users: [{ id: USER_ID }] },
    });

    const result = await getConflictDetail(CONFLICT_ID, COUPLE_ID, USER_ID);

    expect(result.progress.partner).toEqual({
      hasSummary: false,
      approved: false,
      feelingsShared: false,
    });
  });
});

describe("conflict.service closeConflict", () => {
  it("treats a malformed id as not found without querying", async () => {
    await expect(
      closeConflict("nope", COUPLE_ID, { outcome: "resolved" }),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND" });

    expect(db.conflicts.updateMany).not.toHaveBeenCalled();
  });

  it("returns not found when the conflict belongs to another couple", async () => {
    db.conflicts.updateMany.mockResolvedValue({ count: 0 });
    db.conflicts.findFirst.mockResolvedValue(null);

    await expect(
      closeConflict(CONFLICT_ID, COUPLE_ID, { outcome: "resolved" }),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND" });
  });

  it("rejects closing a conflict that is not in feedback", async () => {
    db.conflicts.updateMany.mockResolvedValue({ count: 0 });
    db.conflicts.findFirst.mockResolvedValue({ id: CONFLICT_ID });

    await expect(
      closeConflict(CONFLICT_ID, COUPLE_ID, { outcome: "resolved" }),
    ).rejects.toMatchObject({
      code: "INVALID_STATE_TRANSITION",
      status: 409,
    });

    expect(db.conflicts.updateMany).toHaveBeenCalledWith({
      where: {
        id: CONFLICT_ID,
        couple_id: COUPLE_ID,
        status: "feedback",
      },
      data: {
        status: "closed",
        outcome: "resolved",
        closed_at: expect.any(Date),
      },
    });
  });

  it("closes a feedback conflict and returns the updated row", async () => {
    db.conflicts.updateMany.mockResolvedValue({ count: 1 });
    db.conflicts.findFirst.mockResolvedValue({
      ...conflictRow,
      status: "closed",
      outcome: "resolved",
      closed_at: CLOSED_AT,
    });

    const result = await closeConflict(CONFLICT_ID, COUPLE_ID, {
      outcome: "resolved",
    });

    expect(result).toMatchObject({
      status: "closed",
      outcome: "resolved",
      closedAt: CLOSED_AT.toISOString(),
    });
  });

  it("returns not found when the row disappears after the update", async () => {
    db.conflicts.updateMany.mockResolvedValue({ count: 1 });
    db.conflicts.findFirst.mockResolvedValue(null);

    await expect(
      closeConflict(CONFLICT_ID, COUPLE_ID, { outcome: "later" }),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND" });
  });
});
