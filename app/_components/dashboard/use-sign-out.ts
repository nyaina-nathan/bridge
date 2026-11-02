"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Revokes the refresh token and leaves the dashboard. Shared by the header
 * button and the couple gate so both paths behave the same.
 */
export function useSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) {
      return;
    }

    setPending(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // Still leave the dashboard. The next successful login replaces cookies.
    }

    router.replace("/login");
  }

  return { pending, signOut };
}
