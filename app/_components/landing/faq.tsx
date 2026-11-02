import { PlusIcon } from "@/app/_components/icons";
import { Container, SectionIntro } from "@/app/_components/ui/section";

const faqs = [
  {
    question: "Can my partner read my private chat?",
    answer:
      "No. Your thread with the AI is private to you. Your partner only sees the partner view you approve, plus the feelings you choose to share later.",
  },
  {
    question: "What happens if only one of us approves?",
    answer:
      "The conflict stays in the collecting stage. The shared view stays closed until both people approve, so neither side is revealed early.",
  },
  {
    question: "Is Bridge therapy?",
    answer:
      "No. Bridge is a structured space for communication, not a substitute for a therapist, counsellor, or crisis service.",
  },
  {
    question: "What if we can’t agree?",
    answer:
      "You can close a conflict as resolved, later, or unsolvable. “Later” and “unsolvable” are valid outcomes — understanding does not always mean agreement.",
  },
  {
    question: "Do we have to be online at the same time?",
    answer:
      "No. Bridge is asynchronous. You can write when you have the space, and your partner can respond when they are ready.",
  },
  {
    question: "How do we start?",
    answer:
      "Create a space, share your invite code with your partner, and start a conflict when you are ready. The first step is private.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-28 py-24 sm:py-32">
      <Container className="grid gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionIntro
            eyebrow="FAQ"
            title="The things people ask first."
            body="A few straight answers about privacy, consent, and what happens when a conversation is hard."
          />
        </div>

        <div className="border-t border-line">
          {faqs.map((faq) => (
            <details key={faq.question} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left [&::-webkit-details-marker]:hidden">
                <span className="text-base font-medium text-ink">
                  {faq.question}
                </span>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-colors duration-200 group-open:border-rose/30 group-open:bg-rose-soft group-open:text-rose-deep">
                  <PlusIcon className="size-4 transition-transform duration-200 ease-out-strong group-open:rotate-45" />
                </span>
              </summary>
              <p className="max-w-2xl pb-6 pr-10 text-sm leading-6 text-muted">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
