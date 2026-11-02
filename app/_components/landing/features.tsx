import {
  CheckIcon,
  ClockIcon,
  LockIcon,
  PencilIcon,
} from "@/app/_components/icons";
import { Container, SectionIntro } from "@/app/_components/ui/section";

const features = [
  {
    icon: LockIcon,
    title: "Private by default",
    body: "Your AI chat is visible only to you. Partner views are built from what you choose to summarize.",
  },
  {
    icon: CheckIcon,
    title: "Consent, not surprise",
    body: "The shared view stays closed until both people approve. There is no accidental reveal.",
  },
  {
    icon: PencilIcon,
    title: "AI drafts, you decide",
    body: "Edit your summary, regenerate the reframe, and approve the exact words your partner will read.",
  },
  {
    icon: ClockIcon,
    title: "Room for “later”",
    body: "Resolved, later, or unsolvable are all valid outcomes. Understanding doesn’t always mean agreement.",
  },
];

export function Features() {
  return (
    <section className="py-24 sm:py-32">
      <Container>
        <SectionIntro
          eyebrow="Guardrails"
          title="The guardrails are the product."
          body="Bridge isn’t a live chat between the two of you. It’s a sequence designed to keep the hard parts from getting louder."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article
                key={feature.title}
                className="rounded-3xl border border-line bg-paper p-6 shadow-card sm:p-8"
              >
                <span className="flex size-11 items-center justify-center rounded-2xl bg-rose-soft text-rose-deep">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-6 text-lg font-semibold text-ink">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {feature.body}
                </p>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
