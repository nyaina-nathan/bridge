import { CheckIcon } from "@/app/_components/icons";
import { cx } from "@/lib/utils/cx";
import type { ConflictStatus } from "@/lib/types/conflict.types";

const phases = [
  {
    status: "collecting",
    label: "Talk privately",
    detail: "Share your side",
  },
  {
    status: "feedback",
    label: "Hear each other",
    detail: "Read and respond",
  },
  {
    status: "closed",
    label: "Close the loop",
    detail: "Choose an outcome",
  },
] as const satisfies ReadonlyArray<{
  status: ConflictStatus;
  label: string;
  detail: string;
}>;

type ConflictTimelineProps = {
  status: ConflictStatus;
  className?: string;
};

export function ConflictTimeline({
  status,
  className,
}: ConflictTimelineProps) {
  const currentIndex = phases.findIndex((phase) => phase.status === status);

  return (
    <nav aria-label="Conflict stages" className={className}>
      <ol className="flex items-start">
        {phases.map((phase, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <li
              key={phase.status}
              aria-current={isCurrent ? "step" : undefined}
              className="flex min-w-0 flex-1 flex-col items-center text-center"
            >
              <div aria-hidden="true" className="flex w-full items-center">
                <span
                  className={cx(
                    "h-px flex-1",
                    index === 0
                      ? "bg-transparent"
                      : index <= currentIndex
                        ? "bg-sage/40"
                        : "bg-line",
                  )}
                />
                <span
                  className={cx(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border font-display text-xs transition-colors duration-200 ease-out-strong",
                    isCurrent &&
                      "border-rose/30 bg-rose text-bone shadow-[0_0_0_4px_var(--color-rose-soft)]",
                    isComplete && "border-sage/25 bg-sage-soft text-sage",
                    !isCurrent && !isComplete && "border-line bg-paper text-muted",
                  )}
                >
                  {isComplete ? (
                    <CheckIcon className="size-3.5" />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <span
                  className={cx(
                    "h-px flex-1",
                    index === phases.length - 1
                      ? "bg-transparent"
                      : index < currentIndex
                        ? "bg-sage/40"
                        : "bg-line",
                  )}
                />
              </div>

              <p
                className={cx(
                  "mt-3 text-[11px] font-semibold uppercase tracking-[0.14em]",
                  isCurrent ? "text-ink" : "text-muted",
                )}
              >
                {phase.label}
              </p>
              <p className="mt-1 hidden text-xs leading-5 text-muted sm:block">
                {phase.detail}
              </p>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
