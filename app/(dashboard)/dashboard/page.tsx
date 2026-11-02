import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cache, Suspense } from "react";

import { ConflictList } from "@/app/_components/dashboard/conflict-list";
import { NewConflictButton } from "@/app/_components/dashboard/new-conflict-button";
import { Container } from "@/app/_components/ui/section";
import { getServerAuthContext } from "@/lib/api/auth";
import { listConflicts } from "@/lib/services/conflict.service";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Bridge space.",
};

/**
 * Shared by the heading count and the list. `cache` dedupes the auth read and
 * the query within a single render, and both consumers stream independently.
 */
const loadConflicts = cache(async () => {
  const auth = await getServerAuthContext();

  if (!auth) {
    redirect("/login");
  }

  return listConflicts(auth.coupleId);
});

function conflictCountLabel(count: number): string {
  if (count === 0) {
    return "Nothing yet";
  }

  return count === 1 ? "1 conflict" : `${count} conflicts`;
}

async function ConflictCount() {
  const conflicts = await loadConflicts();

  return <>{conflictCountLabel(conflicts.items.length)}</>;
}

async function ConflictListData() {
  const conflicts = await loadConflicts();

  return <ConflictList items={conflicts.items} />;
}

function ConflictListSkeleton() {
  return (
    <div aria-busy="true" className="mt-5 motion-safe:animate-pulse">
      <span className="sr-only">Loading conflicts…</span>
      <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-paper shadow-card">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between gap-6 px-5 py-5 sm:px-6"
          >
            <div className="min-w-0 flex-1">
              <div className="h-4 w-1/2 rounded-full bg-ink/[0.07]" />
              <div className="mt-2.5 h-3 w-1/3 rounded-full bg-ink/[0.05]" />
            </div>
            <div className="h-6 w-20 shrink-0 rounded-full bg-ink/[0.05]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Container className="py-12 sm:py-20">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-deep">
            <span aria-hidden="true" className="h-px w-7 bg-rose/50" />
            Your space
          </p>
          <h1 className="mt-6 text-balance font-display text-[clamp(2.4rem,5vw,3.75rem)] leading-[1.02] font-normal tracking-[-0.045em] text-ink">
            What needs resolving?
          </h1>
          <p className="mt-5 max-w-lg text-pretty text-base leading-7 text-muted">
            Start with the thing that keeps coming back. You’ll each get a
            private space to work through it, then share only what you both
            approve.
          </p>
        </div>

        <NewConflictButton />
      </div>

      <section aria-labelledby="conflicts-heading" className="mt-14">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="conflicts-heading"
            className="font-display text-2xl tracking-[-0.03em] text-ink"
          >
            Conflicts
          </h2>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            <Suspense
              fallback={
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-16 rounded-full bg-ink/[0.06] align-middle motion-safe:animate-pulse"
                />
              }
            >
              <ConflictCount />
            </Suspense>
          </p>
        </div>

        <Suspense fallback={<ConflictListSkeleton />}>
          <ConflictListData />
        </Suspense>
      </section>
    </Container>
  );
}
