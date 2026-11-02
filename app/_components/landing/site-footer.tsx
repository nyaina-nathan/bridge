import Link from "next/link";

import { Logo } from "@/app/_components/logo";
import { Container } from "@/app/_components/ui/section";

const productLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#why-bridge", label: "Why Bridge" },
  { href: "#safety", label: "Safety" },
  { href: "#faq", label: "FAQ" },
];

const accountLinks = [
  { href: "/login", label: "Log in" },
  { href: "/register", label: "Create a space" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-bone">
      <Container className="py-14 sm:py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.25fr_0.75fr_0.75fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo />
            <p className="mt-5 max-w-xs text-sm leading-6 text-muted">
              A private, consent-first way for two people to work through the
              thing that keeps coming back.
            </p>
          </div>

          <nav aria-label="Product">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink">
              Product
            </h2>
            <ul className="mt-4 space-y-3">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="inline-flex py-1 text-sm text-ink-soft transition-colors duration-200 hover:text-ink"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Account">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink">
              Account
            </h2>
            <ul className="mt-4 space-y-3">
              {accountLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex py-1 text-sm text-ink-soft transition-colors duration-200 hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-line pt-6 text-xs leading-5 text-muted sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-2xl">
            Bridge supports communication; it is not therapy, a crisis service,
            or a substitute for professional care. If you are in immediate
            danger, contact your local emergency number.
          </p>
          <p className="shrink-0">© 2026 Bridge</p>
        </div>
      </Container>
    </footer>
  );
}
