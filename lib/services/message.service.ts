import { ApiError } from "../api/errors";
import { prisma } from "../db/prisma";
import type {
  Message,
  MessageList,
  MessageRole,
} from "../types/message.types";
import { isValidConflictId } from "../validators/conflict.validators";

type MessageRow = {
  id: bigint;
  role: string;
  content: string;
  created_at: Date;
};

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
