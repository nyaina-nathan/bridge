import Link from "next/link";

import { ChevronRightIcon, PlusIcon } from "@/app/_components/icons";
import { cx } from "@/lib/utils/cx";
import type {
  ConflictListItem,
  ConflictOutcome,
  ConflictStatus,
} from "@/lib/types/conflict.types";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const outcomeLabels: Record<ConflictOutcome, string> = {
  resolved: "Resolved",
  later: "Revisit later",
  unsolvable: "Unsolvable",
};

type StatusMeta = {
  label: string;
  className: string;
};

const statusStyles: Record<ConflictStatus, StatusMeta> = {
  collecting: {
    label: "Collecting",
    className: "bg-rose-soft text-rose-deep",
  },
  feedback: {
    label: "Feedback",
    className: "bg-sage-soft text-sage",
  },
  closed: {
    label: "Closed",
    className: "bg-ink/[0.04] text-muted",
  },
};

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function statusMeta(conflict: ConflictListItem): StatusMeta {
  if (conflict.status !== "closed") {
    return statusStyles[conflict.status];
  }

  return {
    label: conflict.outcome ? outcomeLabels[conflict.outcome] : "Closed",
    className:
      conflict.outcome === "resolved"
        ? "bg-sage-soft text-sage"
        : "bg-ink/[0.04] text-muted",
  };
}

type ConflictListProps = {
  items: ConflictListItem[];
};

export function ConflictList({ items }: ConflictListProps) {
  if (items.length === 0) {
    return (
      <div className="mt-5 rounded-3xl border border-dashed border-line bg-paper/60 px-6 py-14 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-soft text-rose-deep">
          <PlusIcon className="size-5" />
        </span>
        <h3 className="mt-5 font-display text-2xl tracking-[-0.03em] text-ink">
          No conflicts yet.
        </h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
          Name the first thing that keeps coming back. You can both work on it
          privately, then share only what you approve.
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-5 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-paper shadow-card">
      {items.map((conflict) => {
        const meta = statusMeta(conflict);

        return (
          <li key={conflict.id}>
            <Link
              href={`/dashboard/conflicts/${conflict.id}`}
              className="group flex flex-col gap-4 px-5 py-5 transition-colors duration-200 ease-out-strong hover:bg-bone/60 focus-visible:outline-offset-[-2px] active:bg-ink/[0.03] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6"
            >
              <div className="min-w-0">
                <p className="text-pretty text-base font-semibold text-ink">
                  {conflict.title}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-muted">
                  <span>
                    Created{" "}
                    <time dateTime={conflict.createdAt}>
                      {formatDate(conflict.createdAt)}
                    </time>
                  </span>
                  <span
                    aria-hidden="true"
                    className="size-1 rounded-full bg-line"
                  />
                  {conflict.closedAt ? (
                    <span>
                      Closed{" "}
                      <time dateTime={conflict.closedAt}>
                        {formatDate(conflict.closedAt)}
                      </time>
                    </span>
                  ) : (
                    <span>Still open</span>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3 self-start sm:self-auto">
                <span
                  className={cx(
                    "inline-flex items-center rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
                    meta.className,
                  )}
                >
                  {meta.label}
                </span>
                <ChevronRightIcon className="size-4 text-muted/60 transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5 group-hover:text-muted" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
