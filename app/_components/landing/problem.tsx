import { Container, SectionIntro } from "@/app/_components/ui/section";

const problems = [
  {
    title: "You say it in the heat of it",
    body: "By the time the words come out, the real need is buried under frustration and timing.",
  },
  {
    title: "It lands as an attack",
    body: "Your partner hears the spike, not the point. The armor goes up before the meaning arrives.",
  },
  {
    title: "The real point gets lost",
    body: "You leave the conversation further apart than before, unsure what you were even fighting about.",
  },
];

export function Problem() {
  return (
    <section id="why-bridge" className="scroll-mt-28 py-24 sm:py-32">
      <Container className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <SectionIntro
            eyebrow="Why Bridge"
            title="Most fights aren’t about the dishes."
            body="They’re about feeling unseen, unheard, or alone in the same room. In the moment, it’s hard to say that clearly — and even harder to hear it. Bridge slows the moment down enough for the real point to surface."
          />

          <blockquote className="mt-12 border-l-2 border-rose/40 pl-6">
            <p className="font-display text-2xl leading-snug tracking-[-0.02em] text-ink">
              “The goal isn’t to agree. It’s to understand what you’re actually
              arguing about.”
            </p>
          </blockquote>
        </div>

        <ol className="list-none border-t border-line">
          {problems.map((problem, index) => (
            <li
              key={problem.title}
              className="grid gap-4 border-b border-line py-7 sm:grid-cols-[3.5rem_1fr] sm:gap-6"
            >
              <span className="font-display text-xl text-rose/70">
                0{index + 1}
              </span>
              <div>
                <h3 className="font-display text-2xl leading-tight tracking-[-0.02em] text-ink">
                  {problem.title}
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                  {problem.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
