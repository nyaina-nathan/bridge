"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
} from "react";

import {
  CheckIcon,
  ClockIcon,
  InfoIcon,
  PauseIcon,
} from "@/app/_components/icons";
import { Button } from "@/app/_components/ui/button";
import { ApiClientError, postJson } from "@/lib/api/client";
import type {
  Conflict,
  ConflictOutcome,
} from "@/lib/types/conflict.types";
import { cx } from "@/lib/utils/cx";

type CloseConflictButtonProps = {
  conflictId: string;
};

const outcomes = [
  {
    value: "resolved",
    label: "Resolved",
    description: "You understand each other and this doesn’t need to come back.",
    Icon: CheckIcon,
  },
  {
    value: "later",
    label: "Revisit later",
    description: "You’ve heard each other, but this needs another conversation.",
    Icon: ClockIcon,
  },
  {
    value: "unsolvable",
    label: "Unsolvable",
    description:
      "You understand each other, but you won’t agree on this — and that’s okay.",
    Icon: PauseIcon,
  },
] as const satisfies ReadonlyArray<{
  value: ConflictOutcome;
  label: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
}>;

export function CloseConflictButton({ conflictId }: CloseConflictButtonProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ConflictOutcome | null>(null);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedOption =
    outcomes.find((option) => option.value === selected) ?? null;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function closeDialog() {
    if (closing) {
      return;
    }

    setOpen(false);
  }

  function handleDialogClose() {
    setOpen(false);

    if (!closing) {
      setSelected(null);
      setError(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected || closing) {
      return;
    }

    setClosing(true);
    setError(null);

    try {
      await postJson<Conflict>(`/api/conflicts/${conflictId}/close`, {
        outcome: selected,
      });

      setOpen(false);
      setSelected(null);
      router.refresh();
    } catch (requestError) {
      if (requestError instanceof ApiClientError) {
        if (requestError.status === 401) {
          router.replace("/login");
          return;
        }

        setError(requestError.fields?.outcome ?? requestError.message);

        if (requestError.status === 409) {
          router.refresh();
        }

        return;
      }

      setError("Couldn’t close this conflict. Please try again.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-ink">Close the loop</p>
          <p className="mt-1 max-w-md text-xs leading-5 text-muted">
            When you’re ready, choose how this ends. Either of you can close it,
            and you’ll both see the outcome.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="shrink-0 self-start sm:self-auto"
        >
          <CheckIcon className="size-4" />
          Close the loop
        </Button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="close-conflict-heading"
        aria-describedby="close-conflict-description"
        onCancel={(event) => {
          if (closing) {
            event.preventDefault();
          }
        }}
        onClose={handleDialogClose}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeDialog();
          }
        }}
        className="problem-dialog m-auto max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-[2rem] border border-line bg-paper p-0 text-ink shadow-lift focus:outline-none"
      >
        <div className="max-h-[calc(100svh-2rem)] overflow-y-auto">
          <form
            onSubmit={handleSubmit}
            aria-busy={closing}
            className="p-6 sm:p-8"
          >
            <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-deep">
              <span aria-hidden="true" className="h-px w-7 bg-rose/50" />
              Final step
            </p>

            <h2
              id="close-conflict-heading"
              className="mt-5 text-balance font-display text-[clamp(1.9rem,4.5vw,2.5rem)] leading-[1.03] font-normal tracking-[-0.04em] text-ink"
            >
              How does this end?
            </h2>

            <p
              id="close-conflict-description"
              className="mt-4 text-pretty text-sm leading-6 text-muted"
            >
              Choose the outcome that fits. Both of you will see it on this
              conflict.
            </p>

            <fieldset className="mt-6" disabled={closing}>
              <legend className="sr-only">Outcome</legend>
              <div className="flex flex-col gap-2.5">
                {outcomes.map(({ value, label, description, Icon }) => {
                  const isSelected = selected === value;

                  return (
                    <label
                      key={value}
                      className={cx(
                        "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-[border-color,background-color,box-shadow] duration-150 ease-out-strong focus-within:border-rose/40 focus-within:shadow-[0_0_0_4px_var(--color-rose-soft)]",
                        isSelected
                          ? "border-rose/40 bg-rose-soft/40"
                          : "border-line bg-paper hover:border-ink/20 hover:bg-bone/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="outcome"
                        value={value}
                        checked={isSelected}
                        onChange={() => setSelected(value)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={cx(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                          isSelected
                            ? "bg-rose-soft text-rose-deep"
                            : "bg-bone text-muted",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">
                          {label}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted">
                          {description}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={cx(
                          "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border",
                          isSelected
                            ? "border-rose bg-rose text-bone"
                            : "border-ink/20 bg-paper",
                        )}
                      >
                        {isSelected ? <CheckIcon className="size-3" /> : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {error ? (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose/20 bg-rose-soft/50 px-3.5 py-3 text-xs leading-5 text-rose-deep"
              >
                <InfoIcon className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={closeDialog}
                disabled={closing}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="md"
                disabled={!selected || closing}
                className="w-full sm:w-auto"
              >
                <CheckIcon className="size-4" />
                {closing
                  ? "Closing…"
                  : selectedOption
                    ? `Close as ${selectedOption.label.toLowerCase()}`
                    : "Choose an outcome"}
              </Button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
