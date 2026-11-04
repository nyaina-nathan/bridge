import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { completeMediatorTurn } from "@/lib/ai/mediator";
import { messageSafetyNotice } from "@/lib/prompts/message.prompts";
import {
  listMessages,
  sendMessage,
} from "@/lib/services/message.service";
import type { MediatorReply } from "@/lib/ai/mediator";
import {
  resetPrismaMock,
  type PrismaMock,
} from "../helpers/prisma-mock";

vi.mock("@/lib/ai/mediator", () => ({
  completeMediatorTurn: vi.fn(),
}));

vi.mock("@/lib/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");

  return { prisma: createPrismaMock() };
});

const mediatorMock = vi.mocked(completeMediatorTurn);
const db = prisma as unknown as PrismaMock;

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PARTNER_ID = "33333333-3333-4333-8333-333333333333";
const COUPLE_ID = "22222222-2222-4222-8222-222222222222";
const CONFLICT_ID = "44444444-4444-4444-8444-444444444444";
const CREATED_AT = new Date("2026-01-02T03:04:05.000Z");

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

const reply: MediatorReply = {
  reply: "It sounds like the silence felt personal.",
  readyToSummarize: false,
  detected: {
    facts: ["messages unanswered"],
    emotions: ["loneliness"],
    needs: ["reassurance"],
  },
  safetyFlag: false,
};

beforeEach(() => {
  resetPrismaMock(db);
  mediatorMock.mockResolvedValue(reply);
});

describe("message.service listMessages", () => {
  it("treats a malformed id as not found", async () => {
    await expect(
      listMessages("nope", COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND" });

    expect(db.conflicts.findFirst).not.toHaveBeenCalled();
  });

  it("treats a foreign conflict as not found", async () => {
    db.conflicts.findFirst.mockResolvedValue(null);

    await expect(
      listMessages(CONFLICT_ID, COUPLE_ID, USER_ID),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND" });
  });

  it("returns only the caller's thread in chronological order", async () => {
    db.conflicts.findFirst.mockResolvedValue({ id: CONFLICT_ID });
    db.messages.findMany.mockResolvedValue([
      {
        id: BigInt(1),
        role: "user",
        content: "Hello",
        created_at: CREATED_AT,
      },
      {
        id: BigInt(2),
        role: "assistant",
        content: "Tell me more",
        created_at: CREATED_AT,
      },
    ]);

    const result = await listMessages(CONFLICT_ID, COUPLE_ID, USER_ID);

    expect(db.messages.findMany).toHaveBeenCalledWith({
      where: { conflict_id: CONFLICT_ID, user_id: USER_ID },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      select: expect.any(Object),
    });
    expect(result).toEqual({
      items: [
        {
          id: 1,
          role: "user",
          content: "Hello",
          createdAt: CREATED_AT.toISOString(),
        },
        {
          id: 2,
          role: "assistant",
          content: "Tell me more",
          createdAt: CREATED_AT.toISOString(),
        },
      ],
    });
  });
});

describe("message.service sendMessage", () => {
  it("treats a malformed id as not found", async () => {
    await expect(
      sendMessage("nope", COUPLE_ID, USER_ID, { content: "Hi" }),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND" });

    expect(mediatorMock).not.toHaveBeenCalled();
  });

  it("treats a foreign or missing conflict as not found", async () => {
    db.conflicts.findFirst.mockResolvedValue(null);

    await expect(
      sendMessage(CONFLICT_ID, COUPLE_ID, USER_ID, { content: "Hi" }),
    ).rejects.toMatchObject({ code: "CONFLICT_NOT_FOUND" });
  });

  it("rejects messages outside the collecting state", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      ...conflictRow,
      status: "feedback",
    });

    await expect(
      sendMessage(CONFLICT_ID, COUPLE_ID, USER_ID, { content: "Hi" }),
    ).rejects.toMatchObject({
      code: "INVALID_STATE_TRANSITION",
      message: "Messages can only be sent while the conflict is collecting",
    });

    expect(mediatorMock).not.toHaveBeenCalled();
  });

  it("rejects callers who are not in the couple", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      ...conflictRow,
      couples: { users: [{ id: PARTNER_ID, display_name: "Grace" }] },
    });

    await expect(
      sendMessage(CONFLICT_ID, COUPLE_ID, USER_ID, { content: "Hi" }),
    ).rejects.toMatchObject({ code: "ACTION_NOT_ALLOWED", status: 403 });
  });

  it("calls the mediator with the private history and stores both messages", async () => {
    db.conflicts.findFirst.mockResolvedValue(conflictRow);
    db.messages.findMany.mockResolvedValue([
      { role: "user", content: "Earlier" },
      { role: "assistant", content: "Earlier reply" },
    ]);
    db.messages.create
      .mockResolvedValueOnce({
        id: BigInt(10),
        role: "user",
        content: "Hi",
        created_at: CREATED_AT,
      })
      .mockResolvedValueOnce({
        id: BigInt(11),
        role: "assistant",
        content: reply.reply,
        created_at: CREATED_AT,
      });

    const result = await sendMessage(CONFLICT_ID, COUPLE_ID, USER_ID, {
      content: "Hi",
    });

    expect(mediatorMock).toHaveBeenCalledWith({
      participantName: "Ada",
      otherName: "Grace",
      history: [
        { role: "user", content: "Earlier" },
        { role: "assistant", content: "Earlier reply" },
      ],
      content: "Hi",
    });
    expect(db.messages.create).toHaveBeenNthCalledWith(1, {
      data: {
        conflict_id: CONFLICT_ID,
        user_id: USER_ID,
        role: "user",
        content: "Hi",
      },
      select: expect.any(Object),
    });
    expect(db.messages.create).toHaveBeenNthCalledWith(2, {
      data: {
        conflict_id: CONFLICT_ID,
        user_id: USER_ID,
        role: "assistant",
        content: reply.reply,
      },
      select: expect.any(Object),
    });
    expect(db.conflicts.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      userMessage: {
        id: 10,
        role: "user",
        content: "Hi",
        createdAt: CREATED_AT.toISOString(),
      },
      assistantMessage: {
        id: 11,
        role: "assistant",
        content: reply.reply,
        createdAt: CREATED_AT.toISOString(),
      },
      readyToSummarize: false,
      safetyNotice: null,
    });
  });

  it("falls back to a neutral name when there is no partner", async () => {
    db.conflicts.findFirst.mockResolvedValue({
      ...conflictRow,
      couples: { users: [{ id: USER_ID, display_name: "Ada" }] },
    });
    db.messages.findMany.mockResolvedValue([]);
    db.messages.create
      .mockResolvedValueOnce({
        id: BigInt(10),
        role: "user",
        content: "Hi",
        created_at: CREATED_AT,
      })
      .mockResolvedValueOnce({
        id: BigInt(11),
        role: "assistant",
        content: reply.reply,
        created_at: CREATED_AT,
      });

    await sendMessage(CONFLICT_ID, COUPLE_ID, USER_ID, { content: "Hi" });

    expect(mediatorMock).toHaveBeenCalledWith(
      expect.objectContaining({ otherName: "their partner" }),
    );
  });

  it("flags the conflict and returns a safety notice", async () => {
    db.conflicts.findFirst.mockResolvedValue(conflictRow);
    db.messages.findMany.mockResolvedValue([]);
    db.messages.create
      .mockResolvedValueOnce({
        id: BigInt(10),
        role: "user",
        content: "Hi",
        created_at: CREATED_AT,
      })
      .mockResolvedValueOnce({
        id: BigInt(11),
        role: "assistant",
        content: "I'm concerned",
        created_at: CREATED_AT,
      });
    mediatorMock.mockResolvedValue({
      ...reply,
      reply: "I'm concerned",
      safetyFlag: true,
    });

    const result = await sendMessage(CONFLICT_ID, COUPLE_ID, USER_ID, {
      content: "Hi",
    });

    expect(db.conflicts.updateMany).toHaveBeenCalledWith({
      where: { id: CONFLICT_ID, couple_id: COUPLE_ID },
      data: { flagged: true },
    });
    expect(result.safetyNotice).toEqual({ message: messageSafetyNotice });
  });

  it("does not write anything when the model fails", async () => {
    db.conflicts.findFirst.mockResolvedValue(conflictRow);
    db.messages.findMany.mockResolvedValue([]);
    mediatorMock.mockRejectedValue(new Error("model down"));

    await expect(
      sendMessage(CONFLICT_ID, COUPLE_ID, USER_ID, { content: "Hi" }),
    ).rejects.toThrow("model down");

    expect(db.messages.create).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("propagates readyToSummarize from the model", async () => {
    db.conflicts.findFirst.mockResolvedValue(conflictRow);
    db.messages.findMany.mockResolvedValue([]);
    db.messages.create
      .mockResolvedValueOnce({
        id: BigInt(10),
        role: "user",
        content: "Hi",
        created_at: CREATED_AT,
      })
      .mockResolvedValueOnce({
        id: BigInt(11),
        role: "assistant",
        content: reply.reply,
        created_at: CREATED_AT,
      });
    mediatorMock.mockResolvedValue({ ...reply, readyToSummarize: true });

    const result = await sendMessage(CONFLICT_ID, COUPLE_ID, USER_ID, {
      content: "Hi",
    });

    expect(result.readyToSummarize).toBe(true);
  });
});
