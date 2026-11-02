import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConflictList } from "@/app/_components/dashboard/conflict-list";
import { NewConflictButton } from "@/app/_components/dashboard/new-conflict-button";
import { Container } from "@/app/_components/ui/section";
import { getServerAuthContext } from "@/lib/api/auth";
import { listConflicts } from "@/lib/services/conflict.service";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Bridge space.",
};

export default async function DashboardPage() {
  const auth = await getServerAuthContext();

  if (!auth) {
    redirect("/login");
  }

  const conflicts = await listConflicts(auth.coupleId);
  const conflictCount = conflicts.items.length;

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
            {conflictCount === 0
              ? "Nothing yet"
              : conflictCount === 1
                ? "1 conflict"
                : `${conflictCount} conflicts`}
          </p>
        </div>

        <ConflictList items={conflicts.items} />
      </section>
    </Container>
  );
}
