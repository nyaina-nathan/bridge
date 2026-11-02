import { CheckIcon, ClockIcon } from "@/app/_components/icons";
import type {
  ConflictDetail,
  ConflictOutcome,
} from "@/lib/types/conflict.types";
import type { Message } from "@/lib/types/message.types";

import { ConflictChat } from "./conflict-chat";

const outcomeLabels: Record<ConflictOutcome, string> = {
  resolved: "Resolved",
  later: "Revisit later",
  unsolvable: "Unsolvable",
};

type ConflictWorkspaceProps = {
  conflict: ConflictDetail;
  initialMessages: Message[];
};

export function ConflictWorkspace({
  conflict,
  initialMessages,
}: ConflictWorkspaceProps) {
  if (conflict.status === "collecting") {
    return (
      <ConflictChat
        conflictId={conflict.id}
        initialMessages={initialMessages}
      />
    );
  }

  const isClosed = conflict.status === "closed";
  const title = isClosed
    ? conflict.outcome
      ? outcomeLabels[conflict.outcome]
      : "Closed"
    : "Hear each other";

  return (
    <section
      aria-labelledby="stage-heading"
      className="mt-8 rounded-[2rem] border border-line bg-paper px-6 py-12 text-center shadow-card sm:px-10"
    >
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-sage-soft text-sage">
        {isClosed ? (
          <CheckIcon className="size-5" />
        ) : (
          <ClockIcon className="size-5" />
        )}
      </span>
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-sage">
        {isClosed ? "Closed" : "Next stage"}
      </p>
      <h2
        id="stage-heading"
        className="mt-2 font-display text-3xl tracking-[-0.03em] text-ink"
      >
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-6 text-muted">
        {isClosed
          ? "This loop is closed. Nothing else needs doing here — you can start a new conflict whenever something comes up again."
          : "You’ve both shared what you needed to. Reading each other’s approved views and sharing how they landed is the next part of Bridge, and it isn’t open here yet."}
      </p>
    </section>
  );
}
