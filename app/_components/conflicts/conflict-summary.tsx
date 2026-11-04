"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  ArrowRightIcon,
  CheckIcon,
  InfoIcon,
  LockIcon,
  PencilIcon,
} from "@/app/_components/icons";
import { Button } from "@/app/_components/ui/button";
import { ApiClientError, postJson, putJson } from "@/lib/api/client";
import type {
  ApproveResponse,
  PartnerViewResponse,
  Perspective,
} from "@/lib/types/perspective.types";

type ConflictSummaryProps = {
  conflictId: string;
  initialSummary: string;
  initialPartnerView: string | null;
  initialApprovedAt: string | null;
};

type Phase = "editing" | "reviewing" | "waiting";

function resolveInitialPhase(
  partnerView: string | null,
  approvedAt: string | null,
): Phase {
  if (approvedAt) {
    return "waiting";
  }

  if (partnerView) {
    return "reviewing";
  }

  return "editing";
}

export function ConflictSummary({
  conflictId,
  initialSummary,
  initialPartnerView,
  initialApprovedAt,
}: ConflictSummaryProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [draft, setDraft] = useState(initialSummary);
  const [savedSummary, setSavedSummary] = useState(initialSummary);
  const [partnerView, setPartnerView] = useState(initialPartnerView);
  const [phase, setPhase] = useState<Phase>(() =>
    resolveInitialPhase(initialPartnerView, initialApprovedAt),
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const trimmedDraft = draft.trim();
  const canSave =
    trimmedDraft.length > 0 && trimmedDraft !== savedSummary && !saving;
  const hasUnsavedEdits =
    trimmedDraft.length > 0 && trimmedDraft !== savedSummary;
  const canGenerate =
    trimmedDraft.length > 0 &&
    trimmedDraft === savedSummary &&
    !saving &&
    !generating;

  const generateHint = !trimmedDraft
    ? "Write your summary before continuing."
    : hasUnsavedEdits
      ? "Save your changes before continuing."
      : "We’ll rewrite this into a calmer version your partner can read.";

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (confirmOpen && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>("[data-confirm]")?.focus();
    } else if (!confirmOpen && dialog.open) {
      dialog.close();
    }
  }, [confirmOpen]);

  useEffect(() => {
    if (!confirmOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [confirmOpen]);

  function closeConfirm() {
    if (generating) {
      return;
    }

    setConfirmOpen(false);
  }

  function handleDialogClose() {
    setConfirmOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSave) {
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const result = await putJson<Perspective>(
        `/api/conflicts/${conflictId}/perspective`,
        { summary: trimmedDraft },
      );
      const nextSummary = result.summary ?? trimmedDraft;

      setDraft(nextSummary);
      setSavedSummary(nextSummary);
      setPartnerView(result.partnerView);
      setSaved(true);
      router.refresh();
    } catch (requestError) {
      if (requestError instanceof ApiClientError) {
        if (requestError.status === 401) {
          router.replace("/login");
          return;
        }

        setError(requestError.fields?.summary ?? requestError.message);
        return;
      }

      setError("Couldn’t save your summary. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    if (!canGenerate || generating) {
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const result = await postJson<PartnerViewResponse>(
        `/api/conflicts/${conflictId}/perspective/partner-view/generate`,
        {},
      );

      setPartnerView(result.partnerView);
      setPhase("reviewing");
      setConfirmOpen(false);
      router.refresh();
    } catch (requestError) {
      setConfirmOpen(false);

      if (requestError instanceof ApiClientError) {
        if (requestError.status === 401) {
          router.replace("/login");
          return;
        }

        setError(requestError.message);

        if (requestError.status === 409) {
          router.refresh();
        }

        return;
      }

      setError("Couldn’t generate a version for your partner. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove() {
    if (approving) {
      return;
    }

    setApproving(true);
    setError(null);

    try {
      await postJson<ApproveResponse>(
        `/api/conflicts/${conflictId}/perspective/approve`,
        {},
      );

      setPhase("waiting");
      router.refresh();
    } catch (requestError) {
      if (requestError instanceof ApiClientError) {
        if (requestError.status === 401) {
          router.replace("/login");
          return;
        }

        setError(requestError.message);

        if (requestError.status === 409) {
          router.refresh();
        }

        return;
      }

      setError("Couldn’t approve your partner view. Please try again.");
    } finally {
      setApproving(false);
    }
  }

  function handleModify() {
    if (approving) {
      return;
    }

    setPhase("editing");
    setError(null);
    setSaved(false);
  }

  const errorNotice = error ? (
    <div
      role="alert"
      className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose/20 bg-rose-soft/50 px-3.5 py-3 text-xs leading-5 text-rose-deep"
    >
      <InfoIcon className="mt-0.5 size-4 shrink-0" />
      <span>{error}</span>
    </div>
  ) : null;

  return (
    <section
      aria-labelledby="summary-heading"
      className="mt-8 overflow-hidden rounded-[2rem] border border-line bg-paper shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-4 sm:px-7">
        <h2
          id="summary-heading"
          className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-deep"
        >
          <LockIcon className="size-4" />
          Your summary
        </h2>
        <p className="text-xs leading-5 text-muted">
          Only you can see this.
        </p>
      </div>

      {phase === "editing" ? (
        <form
          onSubmit={handleSubmit}
          aria-busy={saving}
          className="px-5 py-6 sm:px-7"
        >
          <div className="flex items-start gap-3 rounded-2xl border border-sage/20 bg-sage-soft/70 px-4 py-3">
            <CheckIcon className="mt-0.5 size-5 shrink-0 text-sage" />
            <p className="text-sm leading-6 text-sage">
              <span className="font-medium">
                This is your side, in your words.
              </span>{" "}
              The mediator drafted it from your private conversation. Edit it
              until it sounds like you — nothing is shared yet.
            </p>
          </div>

          {errorNotice}

          <label
            htmlFor="summary"
            className="mt-6 block text-sm font-medium text-ink"
          >
            Edit your summary
          </label>
          <textarea
            id="summary"
            name="summary"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setSaved(false);
            }}
            aria-invalid={error ? true : undefined}
            rows={8}
            className="mt-2 w-full resize-y rounded-2xl border border-line bg-paper px-4 py-3 text-sm leading-6 text-ink outline-none transition-[border-color,box-shadow] duration-200 ease-out-strong placeholder:text-muted/70 focus:border-rose/30 focus:shadow-[0_0_0_4px_var(--color-rose-soft)]"
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="text-xs leading-5 text-muted">
              {saved
                ? "Saved. Your summary stays private."
                : "Your summary stays private until you approve what your partner sees."}
            </p>
            <Button type="submit" size="sm" disabled={!canSave}>
              <PencilIcon className="size-4" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-muted">{generateHint}</p>
            <Button
              type="button"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={!canGenerate}
              aria-haspopup="dialog"
              className="shrink-0 self-start sm:self-auto"
            >
              <ArrowRightIcon className="size-4" />
              Next: generate a version for your partner
            </Button>
          </div>
        </form>
      ) : (
        <div className="px-5 py-6 sm:px-7">
          {phase === "waiting" ? (
            <div className="flex items-start gap-3 rounded-2xl border border-sage/20 bg-sage-soft/70 px-4 py-3">
              <CheckIcon className="mt-0.5 size-5 shrink-0 text-sage" />
              <p className="text-sm leading-6 text-sage">
                <span className="font-medium">Your version is approved.</span>{" "}
                Waiting for your partner to generate and approve theirs. You can
                close this page — your approval is saved.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-2xl border border-rose/20 bg-rose-soft/60 px-4 py-3">
              <LockIcon className="mt-0.5 size-5 shrink-0 text-rose-deep" />
              <p className="text-sm leading-6 text-rose-deep">
                <span className="font-medium">
                  This is the version your partner will read.
                </span>{" "}
                Nothing is shared until you approve it.
              </p>
            </div>
          )}

          {errorNotice}

          <div className="mt-5 rounded-2xl border border-line bg-bone/40 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              What your partner will see
            </p>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">
              {partnerView ?? "No partner view generated yet."}
            </p>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleModify}
              disabled={approving}
              className="self-start"
            >
              <PencilIcon className="size-4" />
              {phase === "waiting"
                ? "Revise my summary"
                : "Modify my summary"}
            </Button>

            {phase === "reviewing" ? (
              <Button
                type="button"
                size="sm"
                onClick={handleApprove}
                disabled={approving}
                aria-busy={approving}
                className="self-start sm:self-auto"
              >
                <CheckIcon className="size-4" />
                {approving ? "Approving…" : "Approve & wait for your partner"}
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="generate-partner-view-heading"
        aria-describedby="generate-partner-view-description"
        onCancel={(event) => {
          if (generating) {
            event.preventDefault();
          }
        }}
        onClose={handleDialogClose}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeConfirm();
          }
        }}
        className="problem-dialog m-auto max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-[2rem] border border-line bg-paper p-0 text-ink shadow-lift focus:outline-none"
      >
        <div className="max-h-[calc(100svh-2rem)] overflow-y-auto p-6 sm:p-8">
          <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-deep">
            <span aria-hidden="true" className="h-px w-7 bg-rose/50" />
            Next step
          </p>

          <h2
            id="generate-partner-view-heading"
            className="mt-5 text-balance font-display text-[clamp(1.65rem,4.5vw,2.1rem)] leading-[1.05] font-normal tracking-[-0.04em] text-ink"
          >
            Generate a version for your partner?
          </h2>

          <p
            id="generate-partner-view-description"
            className="mt-4 text-pretty text-sm leading-6 text-muted"
          >
            The mediator will rewrite your summary into a calmer version your
            partner can read. You’ll see it next, and nothing is shared until
            you approve it.
          </p>

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={closeConfirm}
              disabled={generating}
              className="w-full sm:w-auto"
            >
              Not yet
            </Button>
            <Button
              type="button"
              size="md"
              onClick={handleGenerate}
              disabled={generating}
              aria-busy={generating}
              data-confirm
              className="w-full sm:w-auto"
            >
              <ArrowRightIcon className="size-4" />
              {generating ? "Generating…" : "Generate partner view"}
            </Button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
