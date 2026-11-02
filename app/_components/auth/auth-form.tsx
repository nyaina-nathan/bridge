"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Field } from "@/app/_components/auth/field";
import { ArrowRightIcon, InfoIcon } from "@/app/_components/icons";
import { Button } from "@/app/_components/ui/button";
import { ApiClientError, postJson } from "@/lib/api/client";
import type { AuthSession } from "@/lib/types/auth.types";

type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
};

const FIELD_KEYS = ["displayName", "email", "password", "inviteCode"] as const;

type AuthField = (typeof FIELD_KEYS)[number];

type FieldErrors = Partial<Record<AuthField, string>>;

/** Error codes that belong to a specific input rather than the whole form. */
const CODE_TO_FIELD: Record<string, AuthField> = {
  EMAIL_TAKEN: "email",
  INVALID_INVITE_CODE: "inviteCode",
  COUPLE_FULL: "inviteCode",
};

function isAuthField(value: string): value is AuthField {
  return (FIELD_KEYS as readonly string[]).includes(value);
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";

  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function clearFieldError(field: AuthField) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending) {
      return;
    }

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const inviteCode = String(data.get("inviteCode") ?? "").trim();

    const payload = isRegister
      ? {
          displayName: String(data.get("displayName") ?? "").trim(),
          email,
          password,
          ...(inviteCode ? { inviteCode } : {}),
        }
      : { email, password };

    setPending(true);
    setFormError(null);
    setFieldErrors({});

    try {
      await postJson<AuthSession>(
        isRegister ? "/api/auth/register" : "/api/auth/login",
        payload,
      );

      router.replace("/dashboard");
    } catch (error) {
      setPending(false);

      if (error instanceof ApiClientError) {
        const field = error.code ? CODE_TO_FIELD[error.code] : undefined;

        if (field) {
          setFieldErrors({ [field]: error.message });
          return;
        }

        if (error.code === "VALIDATION_ERROR" && error.fields) {
          const next: FieldErrors = {};

          for (const [key, message] of Object.entries(error.fields)) {
            if (isAuthField(key)) {
              next[key] = message;
            }
          }

          if (Object.keys(next).length > 0) {
            setFieldErrors(next);
            setFormError("Please check the highlighted fields.");
            return;
          }
        }

        setFormError(error.message);
        return;
      }

      setFormError("Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={pending} className="space-y-5">
      {isRegister ? (
        <Field
          id="displayName"
          name="displayName"
          label="Display name"
          type="text"
          autoComplete="name"
          placeholder="Alex"
          error={fieldErrors.displayName}
          onInput={() => clearFieldError("displayName")}
          required
        />
      ) : null}

      <Field
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={fieldErrors.email}
        onInput={() => clearFieldError("email")}
        required
      />

      <Field
        id="password"
        name="password"
        label="Password"
        type="password"
        autoComplete={isRegister ? "new-password" : "current-password"}
        placeholder={isRegister ? "At least 8 characters" : "Your password"}
        minLength={isRegister ? 8 : 1}
        error={fieldErrors.password}
        onInput={() => clearFieldError("password")}
        required
      />

      {isRegister ? (
        <Field
          id="inviteCode"
          name="inviteCode"
          label="Invite code"
          type="text"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="K7M2QX"
          hint="Optional. Add the code from your partner to join their space."
          error={fieldErrors.inviteCode}
          onInput={() => clearFieldError("inviteCode")}
          className="uppercase tracking-[0.12em]"
        />
      ) : null}

      {formError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose/20 bg-rose-soft/50 px-3.5 py-3 text-xs leading-5 text-rose-deep"
        >
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <span>{formError}</span>
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending
          ? isRegister
            ? "Creating account…"
            : "Signing in…"
          : isRegister
            ? "Create account"
            : "Log in"}
        {pending ? null : <ArrowRightIcon className="size-4" />}
      </Button>
    </form>
  );
}
