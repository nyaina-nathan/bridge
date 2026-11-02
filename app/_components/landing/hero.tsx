import {
  ArrowRightIcon,
  CheckIcon,
  LockIcon,
} from "@/app/_components/icons";
import { ButtonLink } from "@/app/_components/ui/button";
import { Container } from "@/app/_components/ui/section";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -right-[24%] -top-[20%] size-[44rem] rounded-full bg-[radial-gradient(circle,rgba(166,52,70,0.12),transparent_65%)]" />
        <div className="absolute -left-[18%] top-[34%] size-[32rem] rounded-full bg-[radial-gradient(circle,rgba(95,122,106,0.08),transparent_65%)]" />
      </div>

      <Container className="grid gap-14 pb-20 pt-16 sm:pt-24 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-16 lg:pb-28 lg:pt-28">
        <div>
          <p className="animate-rise flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-deep sm:text-[11px] sm:tracking-[0.2em]">
            <span
              aria-hidden="true"
              className="hidden h-px w-8 bg-rose/50 sm:block"
            />
            Private by design · Shared by consent
          </p>

          <h1 className="animate-rise animate-rise-delay-1 mt-7 max-w-[13ch] text-balance font-display text-[clamp(3rem,7vw,5.4rem)] leading-[0.96] font-normal tracking-[-0.045em]">
            A <span className="text-rose">calmer</span> way through the same
            fight.
          </h1>

          <p className="animate-rise animate-rise-delay-2 mt-7 max-w-lg text-pretty text-lg leading-8 text-ink-soft">
            A private space for each of you. A shared view you both approve. A
            way to close the loop without another argument.
          </p>

          <div className="animate-rise animate-rise-delay-3 mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/register" size="lg">
              Create your space
              <ArrowRightIcon className="size-4" />
            </ButtonLink>
            <ButtonLink href="#how-it-works" size="lg" variant="secondary">
              See how it works
            </ButtonLink>
          </div>

          <p className="animate-rise animate-rise-delay-4 mt-6 flex max-w-lg items-start gap-2 text-sm leading-6 text-muted">
            <LockIcon className="mt-0.5 size-4 shrink-0 text-rose" />
            Invite your partner with a code. Nothing is shared until you both
            approve it.
          </p>
        </div>

        <HeroPreview />
      </Container>
    </section>
  );
}

function HeroPreview() {
  return (
    <figure
      aria-labelledby="hero-preview-caption"
      className="animate-rise animate-rise-delay-2 relative mx-auto w-full max-w-[34rem] lg:max-w-none"
    >
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-[radial-gradient(circle_at_60%_20%,rgba(166,52,70,0.14),transparent_60%)] blur-2xl"
      />

      <div
        aria-hidden="true"
        className="overflow-hidden rounded-[1.75rem] border border-line bg-paper shadow-lift"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="size-2 shrink-0 rounded-full bg-rose" />
            <span className="truncate text-xs font-medium text-ink-soft">
              Dishes again
            </span>
          </div>
          <span className="shrink-0 rounded-full bg-rose-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-deep">
            Step 4 of 5
          </span>
        </div>

        <div className="grid gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-5">
          <div className="min-w-0 rounded-2xl border border-line bg-white/60 p-3.5 sm:p-4">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              <LockIcon className="size-3.5 text-rose" />
              Your private space
            </div>

            <div className="mt-3.5 space-y-2.5">
              <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2.5 text-[12px] leading-[1.5] text-bone">
                The dishes were left again. I was already running on empty.
              </div>
              <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-rose-soft/70 px-3.5 py-2.5 text-[12px] leading-[1.5] text-ink-soft">
                It sounds like the dishes weren’t the whole story. What else was
                carrying weight?
              </div>
            </div>

            <div className="mt-3.5 rounded-xl border border-dashed border-rose/25 bg-rose-soft/45 p-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-rose-deep">
                AI draft summary
              </p>
              <p className="mt-1.5 text-[12px] leading-[1.5] text-ink-soft">
                I felt alone with the everyday load, and the dishes were the
                moment it spilled over.
              </p>
              <p className="mt-2.5 flex items-center gap-1.5 text-[10px] text-muted">
                <LockIcon className="size-3" />
                Only you can see this
              </p>
            </div>
          </div>

          <div className="flex h-full min-w-0 flex-col rounded-2xl border border-line bg-white/60 p-3.5 sm:p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Shared view
            </div>

            <p className="mt-4 font-display text-[18px] leading-[1.25] tracking-[-0.02em] text-ink">
              “She’d been carrying the day alone. The kitchen felt like one more
              thing she had to hold.”
            </p>

            <div className="mt-auto pt-4">
              <div className="flex items-center gap-2 rounded-xl bg-sage-soft/70 px-3 py-2.5 text-[10px] leading-[1.5] text-sage">
                <CheckIcon className="size-3.5 shrink-0" />
                Approved by both. Visible to each other.
              </div>
            </div>
          </div>
        </div>

        <div className="hidden border-t border-line px-4 py-3 sm:block sm:px-5">
          <div className="flex items-center justify-between gap-1 text-[9px] font-medium uppercase tracking-[0.12em] text-muted">
            <span>1 Explain</span>
            <span>2 Reframe</span>
            <span>3 Approve</span>
            <span className="text-rose-deep">4 Read</span>
            <span>5 Close</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
            <div className="h-full w-4/5 rounded-full bg-rose" />
          </div>
        </div>
      </div>

      <figcaption id="hero-preview-caption" className="sr-only">
        A preview of Bridge: Alex’s private chat and AI summary on the left, and
        the approved view Sam can see on the right.
      </figcaption>
    </figure>
  );
}
