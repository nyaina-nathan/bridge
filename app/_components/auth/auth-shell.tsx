import Link from "next/link";
import type { ReactNode } from "react";

import { BridgeArc } from "@/app/_components/icons";
import { Logo } from "@/app/_components/logo";

type AuthShellProps = {
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[0.95fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-ink px-12 py-10 text-bone lg:flex lg:min-h-svh lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 top-10 size-[30rem] rounded-full bg-[radial-gradient(circle,rgba(166,52,70,0.28),transparent_65%)]" />
          <BridgeArc className="absolute -bottom-8 left-1/2 w-[42rem] -translate-x-1/2 text-bone/10" />
        </div>

        <div className="relative">
          <Logo tone="dark" />
        </div>

        <div className="relative max-w-sm">
          <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-soft">
            <span aria-hidden="true" className="h-px w-7 bg-rose-soft/60" />
            Private by design
          </p>
          <p className="mt-6 text-balance font-display text-[2.8rem] leading-[1.02] tracking-[-0.04em]">
            Nothing is shared until you both approve it.
          </p>
          <p className="mt-5 text-sm leading-6 text-bone/60">
            A private space for each of you. A shared view you both choose.
          </p>
        </div>

        <p className="relative text-xs text-bone/40">
          Bridge · A calmer way through the same fight.
        </p>
      </aside>

      <main
        id="main"
        className="flex min-h-svh flex-col px-5 py-6 sm:px-8 lg:px-12 lg:py-8"
      >
        <div className="flex items-center justify-between lg:hidden">
          <Logo />
          <Link
            href="/"
            className="inline-flex py-2 text-sm font-medium text-ink-soft transition-colors duration-200 hover:text-ink"
          >
            Back home
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-start py-10 lg:justify-center lg:py-12">
          <div className="hidden justify-end lg:flex">
            <Link
              href="/"
              className="inline-flex py-2 text-sm font-medium text-muted transition-colors duration-200 hover:text-ink"
            >
              Back home
            </Link>
          </div>

          <div className="mt-0 lg:mt-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-deep">
              Bridge
            </p>
            <h1 className="mt-4 text-balance font-display text-[clamp(2.5rem,4vw,3.4rem)] leading-[1.0] tracking-[-0.04em] text-ink">
              {title}
            </h1>
            <p className="mt-4 text-base leading-7 text-muted">{subtitle}</p>
          </div>

          <div className="mt-8">{children}</div>
          <div className="mt-8 text-sm text-muted">{footer}</div>
        </div>
      </main>
    </div>
  );
}
