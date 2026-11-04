import { summarizeThread } from "../ai/summarizer";
import { rewriteForPartner } from "../ai/partner-view";
import { ApiError } from "../api/errors";
import { prisma } from "../db/prisma";
import type { MessageRole } from "../types/message.types";
import type {
  ApproveResponse,
  PartnerPerspective,
  PartnerViewResponse,
  Perspective,
  ShareFeelingsResponse,
  SummaryResponse,
} from "../types/perspective.types";
import type {
  ShareFeelingsInput,
  UpdatePerspectiveInput,
} from "../validators/perspective.validators";
import { isValidConflictId } from "../validators/conflict.validators";

const perspectiveSelect = {
  summary: true,
  partner_view: true,
  feelings: true,
  approved_at: true,
  feelings_shared_at: true,
} as const;

type PerspectiveRow = {
  summary: string | null;
  partner_view: string | null;
  feelings: string | null;
  approved_at: Date | null;
  feelings_shared_at: Date | null;
};

const emptyPerspective: Perspective = {
  summary: null,
  partnerView: null,
  feelings: null,
  approvedAt: null,
  feelingsSharedAt: null,
};

function toPerspective(row: PerspectiveRow | null): Perspective {
  if (!row) {
    return emptyPerspective;
  }

  return {
    summary: row.summary,
    partnerView: row.partner_view,
    feelings: row.feelings,
    approvedAt: row.approved_at?.toISOString() ?? null,
    feelingsSharedAt: row.feelings_shared_at?.toISOString() ?? null,
  };
}

/**
 * Resolves a conflict the caller's couple owns. Malformed ids and conflicts
 * from another couple deliberately resolve to `404`.
 */
async function findConflict(
  conflictId: string,
  coupleId: string,
): Promise<{ id: string; status: string }> {
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
    },
  });

  if (!conflict) {
    throw ApiError.notFound();
  }

  return conflict;
}

/** Returns the caller's perspective, or all-null fields when none exists yet. */
export async function getPerspective(
  conflictId: string,
  coupleId: string,
  userId: string,
): Promise<Perspective> {
  await findConflict(conflictId, coupleId);

  const row = await prisma.perspectives.findUnique({
    where: {
      conflict_id_user_id: {
        conflict_id: conflictId,
        user_id: userId,
      },
    },
    select: perspectiveSelect,
  });

  return toPerspective(row);
}

/**
 * Hand-edits the summary. Any content change invalidates the consent gate, so
 * the partner view and approval are cleared.
 */
export async function updatePerspective(
  conflictId: string,
  coupleId: string,
  userId: string,
  input: UpdatePerspectiveInput,
): Promise<Perspective> {
  const conflict = await findConflict(conflictId, coupleId);

  if (conflict.status !== "collecting") {
    throw ApiError.conflict(
      "INVALID_STATE_TRANSITION",
      "Perspectives can only be edited while the conflict is collecting",
    );
  }

  const row = await prisma.perspectives.upsert({
    where: {
      conflict_id_user_id: {
        conflict_id: conflictId,
        user_id: userId,
      },
    },
    create: {
      conflict_id: conflictId,
      user_id: userId,
      summary: input.summary,
    },
    update: {
      summary: input.summary,
      partner_view: null,
      approved_at: null,
    },
    select: perspectiveSelect,
  });

  return toPerspective(row);
}

/**
 * Drafts the summary from the caller's private chat. The previous summary,
 * partner view and approval are replaced only after a successful generation.
 */
export async function generateSummary(
  conflictId: string,
  coupleId: string,
  userId: string,
): Promise<SummaryResponse> {
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
      "Summaries can only be generated while the conflict is collecting",
    );
  }

  const participant = conflict.couples.users.find(
    (member) => member.id === userId,
  );

  if (!participant) {
    throw ApiError.forbidden();
  }

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

  const history = historyRows.map((row) => ({
    role: row.role as MessageRole,
    content: row.content,
  }));

  if (!history.some((message) => message.role === "user")) {
    throw ApiError.conflict(
      "NOT_ENOUGH_CONTEXT",
      "Not enough context to generate a summary",
    );
  }

  const generated = await summarizeThread({
    participantName: participant.display_name,
    history,
  });

  await prisma.perspectives.upsert({
    where: {
      conflict_id_user_id: {
        conflict_id: conflictId,
        user_id: userId,
      },
    },
    create: {
      conflict_id: conflictId,
      user_id: userId,
      summary: generated.summary,
    },
    update: {
      summary: generated.summary,
      partner_view: null,
      approved_at: null,
    },
    select: {
      id: true,
    },
  });

  return { summary: generated.summary };
}

/**
 * Reframes the caller's own summary into the version their partner may read.
 * Nothing is shared until the caller approves this partner view.
 */
export async function generatePartnerView(
  conflictId: string,
  coupleId: string,
  userId: string,
): Promise<PartnerViewResponse> {
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
      "Partner views can only be generated while the conflict is collecting",
    );
  }

  const participant = conflict.couples.users.find(
    (member) => member.id === userId,
  );

  if (!participant) {
    throw ApiError.forbidden();
  }

  const perspective = await prisma.perspectives.findUnique({
    where: {
      conflict_id_user_id: {
        conflict_id: conflictId,
        user_id: userId,
      },
    },
    select: {
      summary: true,
    },
  });

  const summary = perspective?.summary?.trim();

  if (!summary) {
    throw ApiError.conflict(
      "SUMMARY_MISSING",
      "Generate or write a summary first",
    );
  }

  const generated = await rewriteForPartner({
    participantName: participant.display_name,
    summary,
  });

  await prisma.perspectives.update({
    where: {
      conflict_id_user_id: {
        conflict_id: conflictId,
        user_id: userId,
      },
    },
    data: {
      partner_view: generated.partnerView,
      approved_at: null,
    },
    select: {
      id: true,
    },
  });

  return { partnerView: generated.partnerView };
}

/**
 * Approves the current partner view. Both approvals flip the conflict to
 * `feedback`; the conflict row is locked so simultaneous approvals serialize.
 */
export async function approvePerspective(
  conflictId: string,
  coupleId: string,
  userId: string,
): Promise<ApproveResponse> {
  if (!isValidConflictId(conflictId)) {
    throw ApiError.notFound();
  }

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT status
      FROM conflicts
      WHERE id = ${conflictId}::uuid
        AND couple_id = ${coupleId}::uuid
      FOR UPDATE
    `;

    if (locked.length === 0) {
      throw ApiError.notFound();
    }

    const status = locked[0].status;

    if (status === "closed") {
      throw ApiError.conflict(
        "INVALID_STATE_TRANSITION",
        "Approval is not allowed after the conflict is closed",
      );
    }

    const perspective = await tx.perspectives.findUnique({
      where: {
        conflict_id_user_id: {
          conflict_id: conflictId,
          user_id: userId,
        },
      },
      select: {
        partner_view: true,
        approved_at: true,
      },
    });

    if (!perspective?.partner_view?.trim()) {
      throw ApiError.conflict(
        "PARTNER_VIEW_MISSING",
        "Generate a partner view first",
      );
    }

    if (perspective.approved_at) {
      const conflictStatus = status === "feedback" ? "feedback" : "collecting";

      return {
        approvedAt: perspective.approved_at.toISOString(),
        conflictStatus,
      };
    }

    if (status !== "collecting") {
      throw ApiError.conflict(
        "INVALID_STATE_TRANSITION",
        "Approval is only allowed while the conflict is collecting",
      );
    }

    const approvedAt = new Date();

    await tx.perspectives.update({
      where: {
        conflict_id_user_id: {
          conflict_id: conflictId,
          user_id: userId,
        },
      },
      data: {
        approved_at: approvedAt,
      },
      select: {
        id: true,
      },
    });

    const approvedCount = await tx.perspectives.count({
      where: {
        conflict_id: conflictId,
        approved_at: {
          not: null,
        },
      },
    });

    if (approvedCount >= 2) {
      await tx.conflicts.update({
        where: {
          id: conflictId,
        },
        data: {
          status: "feedback",
        },
        select: {
          id: true,
        },
      });

      return {
        approvedAt: approvedAt.toISOString(),
        conflictStatus: "feedback" as const,
      };
    }

    return {
      approvedAt: approvedAt.toISOString(),
      conflictStatus: "collecting" as const,
    };
  });
}

/**
 * Returns only what the partner chose to share: their approved partner view
 * and, once shared, their feelings. Their summary and private chat are never
 * selected. Until both approvals move the conflict to `feedback`, this is
 * unavailable.
 */
export async function getPartnerPerspective(
  conflictId: string,
  coupleId: string,
  userId: string,
): Promise<PartnerPerspective> {
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
            },
          },
        },
      },
    },
  });

  if (!conflict) {
    throw ApiError.notFound();
  }

  if (conflict.status !== "feedback" && conflict.status !== "closed") {
    return { available: false };
  }

  const partner = conflict.couples.users.find(
    (member) => member.id !== userId,
  );

  if (!partner) {
    return { available: false };
  }

  const row = await prisma.perspectives.findUnique({
    where: {
      conflict_id_user_id: {
        conflict_id: conflictId,
        user_id: partner.id,
      },
    },
    select: {
      partner_view: true,
      approved_at: true,
      feelings: true,
      feelings_shared_at: true,
    },
  });

  const partnerView = row?.partner_view?.trim();

  if (!row || !partnerView || !row.approved_at) {
    return { available: false };
  }

  const base = {
    available: true as const,
    partnerView,
    approvedAt: row.approved_at.toISOString(),
  };

  if (row.feelings_shared_at && row.feelings?.trim()) {
    return {
      ...base,
      feelings: row.feelings,
      feelingsSharedAt: row.feelings_shared_at.toISOString(),
    };
  }

  return {
    ...base,
    feelings: null,
    feelingsSharedAt: null,
  };
}

/**
 * Shares or updates how the caller feels after reading the partner's view.
 * Feelings are only writable while the conflict is open for feedback.
 */
export async function shareFeelings(
  conflictId: string,
  coupleId: string,
  userId: string,
  input: ShareFeelingsInput,
): Promise<ShareFeelingsResponse> {
  if (!isValidConflictId(conflictId)) {
    throw ApiError.notFound();
  }

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT status
      FROM conflicts
      WHERE id = ${conflictId}::uuid
        AND couple_id = ${coupleId}::uuid
      FOR UPDATE
    `;

    if (locked.length === 0) {
      throw ApiError.notFound();
    }

    if (locked[0].status !== "feedback") {
      throw ApiError.conflict(
        "INVALID_STATE_TRANSITION",
        "Feelings can only be shared while status is feedback",
      );
    }

    const feelingsSharedAt = new Date();

    const { count } = await tx.perspectives.updateMany({
      where: {
        conflict_id: conflictId,
        user_id: userId,
      },
      data: {
        feelings: input.feelings,
        feelings_shared_at: feelingsSharedAt,
      },
    });

    if (count === 0) {
      throw ApiError.notFound();
    }

    return {
      feelings: input.feelings,
      feelingsSharedAt: feelingsSharedAt.toISOString(),
    };
  });
}
