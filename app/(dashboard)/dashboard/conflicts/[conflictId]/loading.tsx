import { Container } from "@/app/_components/ui/section";

export default function ConflictLoading() {
  return (
    <Container className="py-10 sm:py-14">
      <div
        aria-busy="true"
        className="mx-auto max-w-3xl motion-safe:animate-pulse"
      >
        <span className="sr-only">Loading conflict…</span>

        <div className="h-3 w-24 rounded-full bg-ink/[0.07]" />
        <div className="mt-9 h-3 w-28 rounded-full bg-rose/20" />
        <div className="mt-5 h-10 w-3/4 rounded-xl bg-ink/[0.07]" />
        <div className="mt-4 h-3 w-1/2 rounded-full bg-ink/[0.05]" />

        <div className="mt-8 h-24 rounded-2xl border border-line bg-paper/60" />

        <div className="mt-8 overflow-hidden rounded-[2rem] border border-line bg-paper">
          <div className="h-14 border-b border-line" />
          <div className="flex min-h-72 flex-col gap-4 px-6 py-6">
            <div className="h-16 w-2/3 rounded-3xl bg-ink/[0.05]" />
            <div className="ml-auto h-12 w-1/2 rounded-3xl bg-rose/10" />
            <div className="h-20 w-3/4 rounded-3xl bg-ink/[0.05]" />
          </div>
          <div className="h-24 border-t border-line bg-bone/40" />
        </div>
      </div>
    </Container>
  );
}
