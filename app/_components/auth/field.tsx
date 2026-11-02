import type { ComponentProps } from "react";

import { cx } from "@/lib/utils/cx";

type FieldProps = ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};

export function Field({
  label,
  hint,
  error,
  id,
  className,
  containerClassName,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: FieldProps) {
  const hintId = hint && id ? `${id}-hint` : undefined;
  const errorId = error && id ? `${id}-error` : undefined;
  const describedBy =
    [ariaDescribedBy, hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("space-y-2", containerClassName)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : ariaInvalid}
        className={cx(
          "h-12 w-full rounded-xl border bg-paper px-4 text-base text-ink transition-[border-color,box-shadow] duration-200 ease-out-strong placeholder:text-muted focus:ring-4",
          error
            ? "border-rose/60 focus:border-rose focus:ring-rose/15"
            : "border-line focus:border-rose focus:ring-rose/15",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-xs leading-5 text-rose-deep">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs leading-5 text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
