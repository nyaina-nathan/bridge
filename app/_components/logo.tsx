import Image from "next/image";
import Link from "next/link";

import { cx } from "@/lib/utils/cx";

type LogoProps = {
  tone?: "light" | "dark";
  className?: string;
};

export function Logo({ tone = "light", className }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label="Bridge home"
      className={cx("inline-flex items-center gap-3 py-1", className)}
    >
      <span
        className={cx(
          "overflow-hidden rounded-[10px] ring-1",
          tone === "dark" ? "ring-bone/15" : "ring-ink/10",
        )}
      >
        <Image
          src="/brand/bridge-mark.png"
          alt=""
          width={36}
          height={36}
          sizes="36px"
          className="size-9"
        />
      </span>
      <span
        className={cx(
          "font-display text-[1.45rem] leading-none tracking-[-0.045em]",
          tone === "dark" ? "text-bone" : "text-ink",
        )}
      >
        bridge
      </span>
    </Link>
  );
}
