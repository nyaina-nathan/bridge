"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  CheckIcon,
  InfoIcon,
  LockIcon,
  PencilIcon,
} from "@/app/_components/icons";
import { Button } from "@/app/_components/ui/button";
import { ApiClientError, putJson } from "@/lib/api/client";
import type { Perspective } from "@/lib/types/perspective.types";

type ConflictSummaryProps = {
  conflictId: string;
  initialSummary: string;
};

export function ConflictSummary({
  conflictId,
  initialSummary,
}: ConflictSummaryProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialSummary);
  const [savedSummary, setSavedSummary] = useState(initialSummary);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const trimmedDraft = draft.trim();
  const canSave =
    trimmedDraft.length > 0 && trimmedDraft !== savedSummary && !saving;

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

      <form
        onSubmit={handleSubmit}
        aria-busy={saving}
        className="px-5 py-6 sm:px-7"
      >
        <div className="flex items-start gap-3 rounded-2xl border border-sage/20 bg-sage-soft/70 px-4 py-3">
          <CheckIcon className="mt-0.5 size-5 shrink-0 text-sage" />
          <p className="text-sm leading-6 text-sage">
            <span className="font-medium">This is your side, in your words.</span>{" "}
            The mediator drafted it from your private conversation. Edit it
            until it sounds like you — nothing is shared yet.
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose/20 bg-rose-soft/50 px-3.5 py-3 text-xs leading-5 text-rose-deep"
          >
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

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
      </form>
    </section>
  );
}
