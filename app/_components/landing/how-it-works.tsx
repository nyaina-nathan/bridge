import { LockIcon } from "@/app/_components/icons";
import { Container, SectionIntro } from "@/app/_components/ui/section";
import { cx } from "@/lib/utils/cx";

const steps = [
  {
    title: "Say it privately",
    body: "Start with what happened, in your own words. The AI listens, asks questions, and helps you separate the incident from the feeling underneath.",
  },
  {
    title: "Shape your summary",
    body: "Get a clear summary of your side. Edit it until it sounds like you. This is the only raw material used for the next step.",
  },
  {
    title: "Reframe it for your partner",
    body: "One tap turns your summary into a partner view — direct, human, and easier to hear. Regenerate it until it feels right.",
  },
  {
    title: "Both approve. Then the gate opens.",
    body: "You approve exactly what your partner will see. They do the same. Only when both yeses are in does either view become visible.",
  },
  {
    title: "Read, feel, close the loop",
    body: "Read their approved view, share how it landed, and choose an outcome: resolved, later, or unsolvable. Not every conflict needs a bow on top.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-28 border-y border-line bg-paper/60 py-24 sm:py-32"
    >
      <Container className="grid gap-14 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionIntro
            eyebrow="How it works"
            title="Five steps. No cross-talk."
            body="Move at your own pace. Nothing you write is visible to your partner unless you approve it."
          />

          <div className="mt-10 flex gap-3 rounded-2xl border border-line bg-bone p-5">
            <LockIcon className="mt-0.5 size-5 shrink-0 text-rose" />
            <p className="text-sm leading-6 text-muted">
              <span className="font-medium text-ink">
                Your chat stays yours.
              </span>{" "}
              Bridge uses it to draft your summary, but never shows it to your
              partner.
            </p>
          </div>

          <p className="mt-6 border-l-2 border-rose/30 pl-4 text-xs leading-5 text-muted">
            Changed your mind? Editing your summary clears the old partner view
            and approval, so nothing out of date is ever shared.
          </p>
        </div>

        <ol className="list-none">
          {steps.map((step, index) => {
            const isGate = index === 3;

            return (
              <li
                key={step.title}
                className={cx(
                  "relative border-l pb-10 pl-8 last:pb-0",
                  isGate ? "border-rose/40" : "border-line",
                )}
              >
                <span
                  className={cx(
                    "absolute -left-5 top-0 flex size-10 items-center justify-center rounded-full border font-display text-sm",
                    isGate
                      ? "border-rose/30 bg-rose-soft text-rose-deep"
                      : "border-line bg-paper text-rose-deep",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>

                {isGate ? (
                  <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-rose px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-bone">
                    <LockIcon className="size-3" />
                    Consent gate
                  </span>
                ) : null}

                <h3 className="font-display text-2xl leading-tight tracking-[-0.02em] text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}
