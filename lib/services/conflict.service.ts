import { ApiError } from "../api/errors";
import { prisma } from "../db/prisma";
import type {
  Conflict,
  ConflictDetail,
  ConflictList,
  ConflictListItem,
  ConflictOutcome,
  ConflictProgress,
  ConflictStatus,
  PerspectiveProgress,
} from "../types/conflict.types";
import type {
  CloseConflictInput,
  CreateConflictInput,
} from "../validators/conflict.validators";
import { isValidConflictId } from "../validators/conflict.validators";

const conflictSelect = {
  id: true,
  title: true,
  status: true,
  outcome: true,
  flagged: true,
  created_by: true,
  created_at: true,
  closed_at: true,
} as const;

const conflictListSelect = {
  id: true,
  title: true,
  status: true,
  outcome: true,
  created_at: true,
  closed_at: true,
} as const;

type ConflictRow = {
  id: string;
  title: string;
  status: string;
  outcome: string | null;
  flagged: boolean;
  created_by: string;
  created_at: Date;
  closed_at: Date | null;
};

type ConflictListRow = {
  id: string;
  title: string;
  status: string;
  outcome: string | null;
  created_at: Date;
  closed_at: Date | null;
};

type PerspectiveRow = {
  user_id: string;
  summary: string | null;
  approved_at: Date | null;
  feelings_shared_at: Date | null;
};

function toConflict(row: ConflictRow): Conflict {
  return {
    id: row.id,
    title: row.title,
    status: row.status as ConflictStatus,
    outcome: row.outcome as ConflictOutcome | null,
    flagged: row.flagged,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    closedAt: row.closed_at?.toISOString() ?? null,
  };
}

function toConflictListItem(row: ConflictListRow): ConflictListItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status as ConflictStatus,
    outcome: row.outcome as ConflictOutcome | null,
    createdAt: row.created_at.toISOString(),
    closedAt: row.closed_at?.toISOString() ?? null,
  };
}

function toProgress(perspective?: PerspectiveRow): PerspectiveProgress {
  return {
    hasSummary: perspective?.summary != null,
    approved: perspective?.approved_at != null,
    feelingsShared: perspective?.feelings_shared_at != null,
  };
}

function assertConflictId(conflictId: string): void {
  if (!isValidConflictId(conflictId)) {
    throw ApiError.notFound();
  }
}

export async function createConflict(
  coupleId: string,
  userId: string,
  input: CreateConflictInput,
): Promise<Conflict> {
  const memberCount = await prisma.users.count({
    where: {
      couple_id: coupleId,
    },
  });

  if (memberCount < 2) {
    throw ApiError.forbidden("PARTNER_NOT_JOINED");
  }

  const row = await prisma.conflicts.create({
    data: {
      couple_id: coupleId,
      created_by: userId,
      title: input.title,
    },
    select: conflictSelect,
  });

  return toConflict(row);
}

export async function listConflicts(coupleId: string): Promise<ConflictList> {
  const rows = await prisma.conflicts.findMany({
    where: {
      couple_id: coupleId,
    },
    orderBy: {
      created_at: "desc",
    },
    select: conflictListSelect,
  });

  return {
    items: rows.map(toConflictListItem),
  };
}

export async function getConflictDetail(
  conflictId: string,
  coupleId: string,
  userId: string,
): Promise<ConflictDetail> {
  assertConflictId(conflictId);

  const row = await prisma.conflicts.findFirst({
    where: {
      id: conflictId,
      couple_id: coupleId,
    },
    select: {
      ...conflictSelect,
      perspectives: {
        select: {
          user_id: true,
          summary: true,
          approved_at: true,
          feelings_shared_at: true,
        },
      },
      couples: {
        select: {
          users: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!row) {
    throw ApiError.notFound();
  }

  const partner = row.couples.users.find((member) => member.id !== userId);
  const myPerspective = row.perspectives.find(
    (perspective) => perspective.user_id === userId,
  );
  const partnerPerspective = partner
    ? row.perspectives.find(
        (perspective) => perspective.user_id === partner.id,
      )
    : undefined;

  const progress: ConflictProgress = {
    me: toProgress(myPerspective),
    partner: toProgress(partnerPerspective),
  };

  return {
    ...toConflict(row),
    progress,
  };
}

export async function closeConflict(
  conflictId: string,
  coupleId: string,
  input: CloseConflictInput,
): Promise<Conflict> {
  assertConflictId(conflictId);

  const { count } = await prisma.conflicts.updateMany({
    where: {
      id: conflictId,
      couple_id: coupleId,
      status: "feedback",
    },
    data: {
      status: "closed",
      outcome: input.outcome,
      closed_at: new Date(),
    },
  });

  if (count === 0) {
    const existing = await prisma.conflicts.findFirst({
      where: {
        id: conflictId,
        couple_id: coupleId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw ApiError.notFound();
    }

    throw ApiError.conflict(
      "INVALID_STATE_TRANSITION",
      "Conflict status must be feedback to close it",
    );
  }

  const row = await prisma.conflicts.findFirst({
    where: {
      id: conflictId,
      couple_id: coupleId,
    },
    select: conflictSelect,
  });

  if (!row) {
    throw ApiError.notFound();
  }

  return toConflict(row);
}
