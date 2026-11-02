import {
  BridgeArc,
  InfoIcon,
  ShieldIcon,
} from "@/app/_components/icons";
import { Container, SectionIntro } from "@/app/_components/ui/section";

export function Safety() {
  return (
    <section
      id="safety"
      className="relative scroll-mt-28 overflow-hidden bg-ink py-24 text-bone sm:py-32"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -right-40 top-0 size-[34rem] rounded-full bg-[radial-gradient(circle,rgba(166,52,70,0.25),transparent_65%)]" />
        <BridgeArc className="absolute -bottom-10 left-1/2 w-[48rem] -translate-x-1/2 text-bone/10" />
      </div>

      <Container className="relative grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20">
        <div>
          <SectionIntro
            tone="dark"
            eyebrow="Safety"
            title="Some conversations need more than an app."
            body="If the AI notices signs that someone may be unsafe, Bridge flags the conflict and puts support guidance in front of you."
          />
          <p className="mt-6 max-w-lg text-sm leading-6 text-bone/50">
            Bridge is not a crisis service or a replacement for therapy. If you
            are in immediate danger, contact your local emergency number.
          </p>
        </div>

        <div className="rounded-3xl border border-bone/15 bg-bone/[0.06] p-6 sm:p-8">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-rose-soft">
            <span className="flex size-9 items-center justify-center rounded-full bg-rose/20 text-rose-soft">
              <ShieldIcon className="size-4" />
            </span>
            Example safety notice
          </div>

          <p className="mt-6 font-display text-2xl leading-snug tracking-[-0.02em] text-bone">
            “If you feel unsafe, consider reaching out to a trusted person or
            local support service.”
          </p>

          <div className="mt-6 flex items-start gap-3 border-t border-bone/15 pt-5 text-xs leading-5 text-bone/55">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-rose-soft" />
            The conflict is marked for extra care, and support guidance is shown
            prominently.
          </div>
        </div>
      </Container>
    </section>
  );
}
