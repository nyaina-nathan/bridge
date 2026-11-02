"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { InfoIcon, PlusIcon } from "@/app/_components/icons";
import { Button } from "@/app/_components/ui/button";
import { Field } from "@/app/_components/ui/field";
import { ApiClientError, postJson } from "@/lib/api/client";
import type { Conflict } from "@/lib/types/conflict.types";

const TITLE_MAX_LENGTH = 120;

export function NewConflictButton() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>("input")?.focus();
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
    if (pending) {
      return;
    }

    setOpen(false);
  }

  function handleDialogClose() {
    setOpen(false);

    if (!pending) {
      setTitle("");
      setFieldError(null);
      setFormError(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending) {
      return;
    }

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setFieldError("Give the problem a short name.");
      return;
    }

    setPending(true);
    setFieldError(null);
    setFormError(null);

    try {
      await postJson<Conflict>("/api/conflicts", { title: trimmedTitle });
      setTitle("");
      setOpen(false);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.status === 401) {
          router.replace("/login");
          return;
        }

        const titleMessage = error.fields?.title;

        if (titleMessage) {
          setFieldError(titleMessage);
          return;
        }

        setFormError(error.message);
        return;
      }

      setFormError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="lg"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="w-full sm:w-auto"
      >
        <PlusIcon className="size-4" />
        Resolve new problem
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="new-conflict-heading"
        aria-describedby="new-conflict-description"
        onCancel={(event) => {
          if (pending) {
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
            aria-busy={pending}
            className="p-6 sm:p-8"
          >
            <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-deep">
              <span aria-hidden="true" className="h-px w-7 bg-rose/50" />
              New conflict
            </p>

            <h2
              id="new-conflict-heading"
              className="mt-5 text-balance font-display text-[clamp(1.9rem,4.5vw,2.5rem)] leading-[1.03] font-normal tracking-[-0.04em] text-ink"
            >
              Resolve a new problem.
            </h2>

            <p
              id="new-conflict-description"
              className="mt-4 text-pretty text-sm leading-6 text-muted"
            >
              You’ll each get a private space to talk it through, then approve
              what the other can see.
            </p>

            <div className="mt-6">
              <Field
                id="conflict-title"
                name="title"
                label="What keeps coming back?"
                type="text"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);

                  if (fieldError) {
                    setFieldError(null);
                  }
                }}
                placeholder="The same argument about the dishes"
                hint="A few words is enough. You can add the details inside."
                error={fieldError ?? undefined}
                maxLength={TITLE_MAX_LENGTH}
                autoComplete="off"
                required
              />
            </div>

            {formError ? (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose/20 bg-rose-soft/50 px-3.5 py-3 text-xs leading-5 text-rose-deep"
              >
                <InfoIcon className="mt-0.5 size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            ) : null}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={closeDialog}
                disabled={pending}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="md"
                disabled={pending}
                className="w-full sm:w-auto"
              >
                {pending ? "Starting…" : "Start resolving"}
              </Button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
