import Link from "next/link";

import { Logo } from "@/app/_components/logo";
import { ButtonLink } from "@/app/_components/ui/button";
import { Container } from "@/app/_components/ui/section";

const navItems = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#why-bridge", label: "Why Bridge" },
  { href: "#safety", label: "Safety" },
  { href: "#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-bone/85 backdrop-blur-xl">
      <Container className="flex h-[4.5rem] items-center justify-between gap-6">
        <Logo />

        <nav
          aria-label="Primary"
          className="hidden items-center gap-7 lg:flex"
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex py-2 text-sm text-ink-soft transition-colors duration-200 hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/login"
            className="hidden whitespace-nowrap rounded-full px-3 py-3 text-sm font-medium text-ink-soft transition-colors duration-200 hover:bg-ink/[0.05] hover:text-ink min-[380px]:inline-flex"
          >
            Log in
          </Link>
          <ButtonLink href="/register" size="sm">
            Get started
          </ButtonLink>
        </div>
      </Container>
    </header>
  );
}
