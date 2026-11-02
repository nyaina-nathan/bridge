import type { ReactNode } from "react";

import { cx } from "@/lib/utils/cx";

type ContainerProps = {
  children: ReactNode;
  className?: string;
};

export function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={cx(
        "mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10",
        className,
      )}
    >
      {children}
    </div>
  );
}

type SectionIntroProps = {
  eyebrow: string;
  title: ReactNode;
  body?: ReactNode;
  tone?: "light" | "dark";
  className?: string;
};

export function SectionIntro({
  eyebrow,
  title,
  body,
  tone = "light",
  className,
}: SectionIntroProps) {
  const isDark = tone === "dark";

  return (
    <div className={className}>
      <p
        className={cx(
          "flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em]",
          isDark ? "text-rose-soft" : "text-rose-deep",
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "h-px w-7",
            isDark ? "bg-rose-soft/60" : "bg-rose/50",
          )}
        />
        {eyebrow}
      </p>
      <h2
        className={cx(
          "mt-6 max-w-xl text-balance font-display text-[clamp(2.35rem,4.2vw,3.75rem)] leading-[1.02] font-normal tracking-[-0.04em]",
          isDark ? "text-bone" : "text-ink",
        )}
      >
        {title}
      </h2>
      {body ? (
        <p
          className={cx(
            "mt-6 max-w-xl text-pretty text-base leading-7",
            isDark ? "text-bone/65" : "text-muted",
          )}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
}
