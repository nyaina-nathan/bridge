import { ApiError } from "../api/errors";
import { completeMediatorTurn } from "../ai/mediator";
import { prisma } from "../db/prisma";
import { messageSafetyNotice } from "../prompts/message.prompts";
import type {
  Message,
  MessageList,
  MessageRole,
  SendMessageResult,
} from "../types/message.types";
import type { SendMessageInput } from "../validators/message.validators";
import { isValidConflictId } from "../validators/conflict.validators";

type MessageRow = {
  id: bigint;
  role: string;
  content: string;
  created_at: Date;
};

const messageSelect = {
  id: true,
  role: true,
  content: true,
  created_at: true,
} as const;

function toMessage(row: MessageRow): Message {
  return {
    id: Number(row.id),
    role: row.role as MessageRole,
    content: row.content,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Returns only the caller's private thread for a conflict. Conflicts from
 * another couple (and malformed ids) deliberately resolve to `404`.
 */
export async function listMessages(
  conflictId: string,
  coupleId: string,
  userId: string,
): Promise<MessageList> {
  if (!isValidConflictId(conflictId)) {
    throw ApiError.notFound();
  }

  const conflict = await prisma.conflicts.findFirst({
    where: {
      id: conflictId,
      couple_id: coupleId,
    },
    select: {
      id: true,
    },
  });

  if (!conflict) {
    throw ApiError.notFound();
  }

  const rows = await prisma.messages.findMany({
    where: {
      conflict_id: conflictId,
      user_id: userId,
    },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: {
      id: true,
      role: true,
      content: true,
      created_at: true,
    },
  });

  return {
    items: rows.map(toMessage),
  };
}

/**
 * Sends one private message and stores the mediator's reply.
 *
 * The model call happens before anything is written, so a failed call leaves
 * the thread untouched and the participant can retry without duplicates. The
 * reply, the user message, and the safety flag are then saved atomically.
 */
export async function sendMessage(
  conflictId: string,
  coupleId: string,
  userId: string,
  input: SendMessageInput,
): Promise<SendMessageResult> {
  if (!isValidConflictId(conflictId)) {
    throw ApiError.notFound();
  }

  const conflict = await prisma.conflicts.findFirst({
    where: {
      id: conflictId,
      couple_id: coupleId,
    },
    select: {
      id: true,
      status: true,
      couples: {
        select: {
          users: {
            select: {
              id: true,
              display_name: true,
            },
          },
        },
      },
    },
  });

  if (!conflict) {
    throw ApiError.notFound();
  }

  if (conflict.status !== "collecting") {
    throw ApiError.conflict(
      "INVALID_STATE_TRANSITION",
      "Messages can only be sent while the conflict is collecting",
    );
  }

  const participant = conflict.couples.users.find(
    (member) => member.id === userId,
  );

  if (!participant) {
    throw ApiError.forbidden();
  }

  const partner = conflict.couples.users.find((member) => member.id !== userId);

  const historyRows = await prisma.messages.findMany({
    where: {
      conflict_id: conflictId,
      user_id: userId,
    },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: {
      role: true,
      content: true,
    },
  });

  const reply = await completeMediatorTurn({
    participantName: participant.display_name,
    otherName: partner?.display_name ?? "their partner",
    history: historyRows.map((row) => ({
      role: row.role as MessageRole,
      content: row.content,
    })),
    content: input.content,
  });

  const { userRow, assistantRow } = await prisma.$transaction(async (tx) => {
    const userRow = await tx.messages.create({
      data: {
        conflict_id: conflictId,
        user_id: userId,
        role: "user",
        content: input.content,
      },
      select: messageSelect,
    });

    const assistantRow = await tx.messages.create({
      data: {
        conflict_id: conflictId,
        user_id: userId,
        role: "assistant",
        content: reply.reply,
      },
      select: messageSelect,
    });

    if (reply.safetyFlag) {
      await tx.conflicts.updateMany({
        where: {
          id: conflictId,
          couple_id: coupleId,
        },
        data: {
          flagged: true,
        },
      });
    }

    return { userRow, assistantRow };
  });

  return {
    userMessage: toMessage(userRow),
    assistantMessage: toMessage(assistantRow),
    readyToSummarize: reply.readyToSummarize,
    safetyNotice: reply.safetyFlag
      ? { message: messageSafetyNotice }
      : null,
  };
}
