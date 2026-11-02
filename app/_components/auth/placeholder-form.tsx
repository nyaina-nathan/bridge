"use client";

import { useState } from "react";

import { Field } from "@/app/_components/auth/field";
import { ArrowRightIcon, InfoIcon } from "@/app/_components/icons";
import { Button } from "@/app/_components/ui/button";

type PlaceholderFormProps = {
  mode: "login" | "register";
};

export function PlaceholderForm({ mode }: PlaceholderFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const isRegister = mode === "register";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
      className="space-y-5"
    >
      {isRegister ? (
        <Field
          id="displayName"
          name="displayName"
          label="Display name"
          type="text"
          autoComplete="name"
          placeholder="Alex"
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
          className="uppercase tracking-[0.12em]"
        />
      ) : null}

      <Button type="submit" size="lg" className="w-full">
        {isRegister ? "Create account" : "Log in"}
        <ArrowRightIcon className="size-4" />
      </Button>

      <div
        role="status"
        aria-live="polite"
        className="flex items-start gap-2.5 rounded-xl border border-rose/15 bg-rose-soft/45 px-3.5 py-3 text-xs leading-5 text-rose-deep"
      >
        <InfoIcon className="mt-0.5 size-4 shrink-0" />
        <span>
          {submitted
            ? "Still a preview — authentication isn’t connected yet. Nothing was sent."
            : "Preview only — authentication isn’t connected yet. This form won’t send anything."}
        </span>
      </div>
    </form>
  );
}
