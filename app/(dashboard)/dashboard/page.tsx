import type { Metadata } from "next";

import { CheckIcon, LockIcon, PlusIcon } from "@/app/_components/icons";
import { Container } from "@/app/_components/ui/section";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Bridge space.",
};

const nextSteps = [
  {
    icon: PlusIcon,
    title: "Start a conflict",
    body: "Name the thing that keeps coming back, once you have the space for it.",
  },
  {
    icon: LockIcon,
    title: "Talk it through privately",
    body: "A private AI thread helps separate the incident from what it stirred up.",
  },
  {
    icon: CheckIcon,
    title: "Approve before sharing",
    body: "The shared view opens only after you both approve what the other will read.",
  },
];

export default function DashboardPage() {
  return (
    <Container className="py-16 sm:py-24">
      <div className="max-w-2xl">
        <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-deep">
          <span aria-hidden="true" className="h-px w-7 bg-rose/50" />
          Your space
        </p>
        <h1 className="mt-6 text-balance font-display text-[clamp(2.6rem,5vw,4.25rem)] leading-[1] font-normal tracking-[-0.045em] text-ink">
          Your dashboard is taking shape.
        </h1>
        <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-muted">
          Authentication is connected. Conflict threads, the private AI chat,
          and the consent gate come next.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {nextSteps.map((step) => {
          const Icon = step.icon;

          return (
            <article
              key={step.title}
              className="rounded-3xl border border-line bg-paper p-6 shadow-card"
            >
              <span className="flex size-10 items-center justify-center rounded-2xl bg-rose-soft text-rose-deep">
                <Icon className="size-4" />
              </span>
              <h2 className="mt-5 text-base font-semibold text-ink">
                {step.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-8 rounded-3xl border border-dashed border-line bg-paper/60 px-6 py-14 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-soft text-rose-deep">
          <PlusIcon className="size-5" />
        </span>
        <h2 className="mt-5 font-display text-3xl tracking-[-0.03em] text-ink">
          No conflicts yet.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
          Once conflict creation lands, your open and closed threads will live
          here — each one private until you both approve what to share.
        </p>
        <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          Preview placeholder
        </p>
      </div>
    </Container>
  );
}
