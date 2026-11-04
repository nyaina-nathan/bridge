"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  ArrowRightIcon,
  CheckIcon,
  InfoIcon,
  LockIcon,
  PencilIcon,
} from "@/app/_components/icons";
import { Button } from "@/app/_components/ui/button";
import { ApiClientError, postJson } from "@/lib/api/client";
import type {
  PartnerPerspective,
  ShareFeelingsResponse,
} from "@/lib/types/perspective.types";

import { CloseConflictButton } from "./close-conflict-button";

type ConflictFeedbackProps = {
  conflictId: string;
  partnerPerspective: PartnerPerspective;
  initialFeelings: string | null;
  initialFeelingsSharedAt: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

export function ConflictFeedback({
  conflictId,
  partnerPerspective,
  initialFeelings,
  initialFeelingsSharedAt,
}: ConflictFeedbackProps) {
  const router = useRouter();

  const [feelings, setFeelings] = useState(initialFeelings ?? "");
  const [feelingsSharedAt, setFeelingsSharedAt] = useState(
    initialFeelingsSharedAt,
  );
  const [draft, setDraft] = useState(initialFeelings ?? "");
  const [editing, setEditing] = useState(!initialFeelingsSharedAt);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedDraft = draft.trim();
  const canSave = trimmedDraft.length > 0 && !saving && trimmedDraft !== feelings;

  const errorNotice = error ? (
    <div
      role="alert"
      className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose/20 bg-rose-soft/50 px-3.5 py-3 text-xs leading-5 text-rose-deep"
    >
      <InfoIcon className="mt-0.5 size-4 shrink-0" />
      <span>{error}</span>
    </div>
  ) : null;

  if (!partnerPerspective.available) {
    return (
      <section
        aria-labelledby="feedback-heading"
        className="mt-8 overflow-hidden rounded-[2rem] border border-line bg-paper shadow-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-4 sm:px-7">
          <h2
            id="feedback-heading"
            className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-deep"
          >
            <LockIcon className="size-4" />
            Hear each other
          </h2>
          <p className="text-xs leading-5 text-muted">
            Only what you both approved is shared.
          </p>
        </div>

        <div className="px-5 py-8 sm:px-7">
          <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-line bg-bone/30 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-muted">
              Your partner’s view isn’t ready yet. It can take a moment after
              they approve.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => router.refresh()}
              className="shrink-0 self-start sm:self-auto"
            >
              Check again
            </Button>
          </div>
        </div>
      </section>
    );
  }

  function handleEdit() {
    if (saving) {
      return;
    }

    setDraft(feelings);
    setEditing(true);
    setError(null);
    setSaved(false);
  }

  function handleCancel() {
    if (saving) {
      return;
    }

    setDraft(feelings);
    setEditing(false);
    setError(null);
    setSaved(false);
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
      const result = await postJson<ShareFeelingsResponse>(
        `/api/conflicts/${conflictId}/perspective/feelings`,
        { feelings: trimmedDraft },
      );

      setFeelings(result.feelings);
      setFeelingsSharedAt(result.feelingsSharedAt);
      setDraft(result.feelings);
      setEditing(false);
      setSaved(true);
      router.refresh();
    } catch (requestError) {
      if (requestError instanceof ApiClientError) {
        if (requestError.status === 401) {
          router.replace("/login");
          return;
        }

        setError(requestError.fields?.feelings ?? requestError.message);

        if (requestError.status === 409) {
          router.refresh();
        }

        return;
      }

      setError("Couldn’t share your feelings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="feedback-heading"
      className="mt-8 overflow-hidden rounded-[2rem] border border-line bg-paper shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-4 sm:px-7">
        <h2
          id="feedback-heading"
          className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-deep"
        >
          <LockIcon className="size-4" />
          Hear each other
        </h2>
        <p className="text-xs leading-5 text-muted">
          Only what you both approved is shared.
        </p>
      </div>

      <div className="px-5 py-6 sm:px-7">
        <div className="flex items-start gap-3 rounded-2xl border border-sage/20 bg-sage-soft/70 px-4 py-3">
          <CheckIcon className="mt-0.5 size-5 shrink-0 text-sage" />
          <p className="text-sm leading-6 text-sage">
            <span className="font-medium">You’ve both shared your side.</span>{" "}
            Read what your partner chose to share, then say how it landed for
            you.
          </p>
        </div>

        <article className="mt-6 rounded-2xl border border-line bg-bone/40 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              What your partner chose to share
            </p>
            <p className="text-xs leading-5 text-muted">
              Approved {formatDate(partnerPerspective.approvedAt)}
            </p>
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">
            {partnerPerspective.partnerView}
          </p>
        </article>

        {partnerPerspective.feelings ? (
          <article className="mt-4 rounded-2xl border border-sage/20 bg-sage-soft/40 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sage">
                How it landed for them
              </p>
              {partnerPerspective.feelingsSharedAt ? (
                <p className="text-xs leading-5 text-muted">
                  Shared {formatDate(partnerPerspective.feelingsSharedAt)}
                </p>
              ) : null}
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">
              {partnerPerspective.feelings}
            </p>
          </article>
        ) : (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-dashed border-line bg-bone/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-muted">
              They haven’t shared how this landed yet. You can check again in a
              moment.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => router.refresh()}
              className="shrink-0 self-start sm:self-auto"
            >
              Check again
            </Button>
          </div>
        )}

        <div className="mt-6 border-t border-line pt-6">
          {feelingsSharedAt && !editing ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-deep">
                  How it landed for you
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  disabled={saving}
                >
                  <PencilIcon className="size-4" />
                  Edit
                </Button>
              </div>
              <div className="mt-3 rounded-2xl border border-rose/20 bg-rose-soft/40 px-4 py-4">
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">
                  {feelings}
                </p>
              </div>
              <p aria-live="polite" className="mt-3 text-xs leading-5 text-muted">
                {saved
                  ? "Saved. Your partner can read this."
                  : "Your partner can read this. Your summary and private chat stay private."}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} aria-busy={saving}>
              <label
                htmlFor="feelings"
                className="block text-sm font-medium text-ink"
              >
                How did reading their side land for you?
              </label>
              <p className="mt-1 text-xs leading-5 text-muted">
                Your partner will be able to read this. Your summary and private
                chat stay private.
              </p>

              {errorNotice}

              <textarea
                id="feelings"
                name="feelings"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setSaved(false);
                }}
                aria-invalid={error ? true : undefined}
                rows={4}
                className="mt-3 w-full resize-y rounded-2xl border border-line bg-paper px-4 py-3 text-sm leading-6 text-ink outline-none transition-[border-color,box-shadow] duration-200 ease-out-strong placeholder:text-muted/70 focus:border-rose/30 focus:shadow-[0_0_0_4px_var(--color-rose-soft)]"
              />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p aria-live="polite" className="text-xs leading-5 text-muted">
                  {saved
                    ? "Shared with your partner."
                    : "Take your time — there’s no rush."}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {feelingsSharedAt ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleCancel}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  ) : null}
                  <Button type="submit" size="sm" disabled={!canSave}>
                    <ArrowRightIcon className="size-4" />
                    {saving
                      ? "Sharing…"
                      : feelingsSharedAt
                        ? "Update how it landed"
                        : "Share how this landed"}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="mt-6 border-t border-line pt-6">
          <CloseConflictButton conflictId={conflictId} />
        </div>
      </div>
    </section>
  );
}
