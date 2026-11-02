import { ArrowRightIcon, BridgeArc } from "@/app/_components/icons";
import { ButtonLink } from "@/app/_components/ui/button";
import { Container } from "@/app/_components/ui/section";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-ink py-20 text-bone sm:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute left-1/2 top-0 h-[24rem] w-[48rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(166,52,70,0.22),transparent_65%)]" />
        <BridgeArc className="absolute -bottom-14 left-1/2 w-[58rem] -translate-x-1/2 text-bone/10" />
      </div>

      <Container className="relative text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-soft">
          Start where you are
        </p>
        <h2 className="mx-auto mt-6 max-w-3xl text-balance font-display text-[clamp(2.6rem,5.5vw,4.5rem)] leading-[0.98] font-normal tracking-[-0.045em]">
          The next conversation can feel different.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-7 text-bone/65">
          Create a space, invite your partner, and take the first step privately.
          You don’t need the perfect words yet.
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/register" size="lg">
            Create your space
            <ArrowRightIcon className="size-4" />
          </ButtonLink>
          <ButtonLink href="/login" size="lg" variant="outline-inverse">
            Log in
          </ButtonLink>
        </div>

        <p className="mt-6 text-xs leading-5 text-bone/45">
          Invite your partner when you’re ready. Nothing is shared until you both
          approve it.
        </p>
      </Container>
    </section>
  );
}
