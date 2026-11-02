import {
  CheckIcon,
  LockIcon,
  PauseIcon,
  ShieldIcon,
} from "@/app/_components/icons";
import { Container } from "@/app/_components/ui/section";

const promises = [
  {
    icon: LockIcon,
    title: "Your chat stays yours",
    body: "A private thread with the AI, visible only to you.",
  },
  {
    icon: CheckIcon,
    title: "Both approve first",
    body: "The shared view opens only after two clear yeses.",
  },
  {
    icon: PauseIcon,
    title: "No live cross-talk",
    body: "Write when you have the space, not in the heat of it.",
  },
  {
    icon: ShieldIcon,
    title: "Safety-aware",
    body: "Support surfaces when the AI notices risk.",
  },
];

export function TrustStrip() {
  return (
    <section className="border-y border-line bg-paper/70">
      <Container className="py-10">
        <h2 className="sr-only">What makes Bridge different</h2>
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-line">
          {promises.map((promise, index) => {
            const Icon = promise.icon;

            return (
              <li
                key={promise.title}
                className={
                  index === 0
                    ? "flex gap-3.5 lg:pr-8"
                    : index === promises.length - 1
                      ? "flex gap-3.5 lg:pl-8"
                      : "flex gap-3.5 lg:px-8"
                }
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-soft text-rose-deep">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {promise.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {promise.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
