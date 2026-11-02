"use client";

import { Button } from "@/app/_components/ui/button";

import { useSignOut } from "./use-sign-out";

export function SignOutButton() {
  const { pending, signOut } = useSignOut();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={signOut}
      disabled={pending}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
