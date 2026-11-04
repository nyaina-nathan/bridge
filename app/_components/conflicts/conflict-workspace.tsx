import { CheckIcon } from "@/app/_components/icons";
import type {
  ConflictDetail,
  ConflictOutcome,
} from "@/lib/types/conflict.types";
import type { Message } from "@/lib/types/message.types";
import type { PartnerPerspective } from "@/lib/types/perspective.types";

import { ConflictChat } from "./conflict-chat";
import { ConflictFeedback } from "./conflict-feedback";

const outcomeLabels: Record<ConflictOutcome, string> = {
  resolved: "Resolved",
  later: "Revisit later",
  unsolvable: "Unsolvable",
};

type ConflictWorkspaceProps = {
  conflict: ConflictDetail;
  initialMessages: Message[];
  initialSummary: string | null;
  /** The caller's own reframed view — what their partner will read. */
  initialPartnerView: string | null;
  initialApprovedAt: string | null;
  /** The partner's approved view and feelings — what they chose to share. */
  initialPartnerPerspective: PartnerPerspective;
  initialFeelings: string | null;
  initialFeelingsSharedAt: string | null;
};

export function ConflictWorkspace({
  conflict,
  initialMessages,
  initialSummary,
  initialPartnerView,
  initialApprovedAt,
  initialPartnerPerspective,
  initialFeelings,
  initialFeelingsSharedAt,
}: ConflictWorkspaceProps) {
  if (conflict.status === "collecting") {
    return (
      <ConflictChat
        conflictId={conflict.id}
        initialMessages={initialMessages}
        initialSummary={initialSummary}
        initialPartnerView={initialPartnerView}
        initialApprovedAt={initialApprovedAt}
      />
    );
  }

  if (conflict.status === "feedback") {
    return (
      <ConflictFeedback
        conflictId={conflict.id}
        partnerPerspective={initialPartnerPerspective}
        initialFeelings={initialFeelings}
        initialFeelingsSharedAt={initialFeelingsSharedAt}
      />
    );
  }

  const title = conflict.outcome
    ? outcomeLabels[conflict.outcome]
    : "Closed";

  return (
    <section
      aria-labelledby="stage-heading"
      className="mt-8 rounded-[2rem] border border-line bg-paper px-6 py-12 text-center shadow-card sm:px-10"
    >
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-sage-soft text-sage">
        <CheckIcon className="size-5" />
      </span>
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-sage">
        Closed
      </p>
      <h2
        id="stage-heading"
        className="mt-2 font-display text-3xl tracking-[-0.03em] text-ink"
      >
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-6 text-muted">
        This loop is closed. Nothing else needs doing here — you can start a new
        conflict whenever something comes up again.
      </p>
    </section>
  );
}
