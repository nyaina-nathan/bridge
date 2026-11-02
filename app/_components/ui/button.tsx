import Link from "next/link";
import type { ComponentProps } from "react";

import { cx } from "@/lib/utils/cx";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "inverse"
  | "outline-inverse";

export type ButtonSize = "sm" | "md" | "lg";

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

const buttonBase =
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,border-color,color,box-shadow] duration-200 ease-out-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-rose text-bone hover:bg-rose-deep",
  secondary:
    "border border-ink/15 bg-transparent text-ink hover:border-ink/25 hover:bg-ink/[0.04]",
  ghost: "text-ink hover:bg-ink/[0.05]",
  inverse: "bg-bone text-ink hover:bg-white",
  "outline-inverse":
    "border border-bone/25 bg-transparent text-bone hover:border-bone/40 hover:bg-bone/10",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-11 px-5 text-sm",
  md: "h-12 px-6 text-sm",
  lg: "h-14 px-7 text-base",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: ButtonStyleOptions = {}) {
  return cx(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & ButtonStyleOptions;

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonStyles({ variant, size, className })}
      {...props}
    />
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & ButtonStyleOptions;

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonStyles({ variant, size, className })} {...props} />
  );
}
