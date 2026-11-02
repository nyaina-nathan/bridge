import type { ComponentProps } from "react";

import { cx } from "@/lib/utils/cx";

type FieldProps = ComponentProps<"input"> & {
  label: string;
  hint?: string;
  containerClassName?: string;
};

export function Field({
  label,
  hint,
  id,
  className,
  containerClassName,
  ...props
}: FieldProps) {
  const hintId = hint && id ? `${id}-hint` : undefined;

  return (
    <div className={cx("space-y-2", containerClassName)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hintId}
        className={cx(
          "h-12 w-full rounded-xl border border-line bg-paper px-4 text-base text-ink transition-[border-color,box-shadow] duration-200 ease-out-strong placeholder:text-muted focus:border-rose focus:ring-4 focus:ring-rose/15",
          className,
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-xs leading-5 text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
