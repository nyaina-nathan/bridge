import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/app/_components/auth/auth-shell";
import { PlaceholderForm } from "@/app/_components/auth/placeholder-form";

export const metadata: Metadata = {
  title: "Create your space",
  description:
    "Create a private Bridge space and invite your partner when you are ready.",
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your space."
      subtitle="Start privately. Invite your partner when you’re ready."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-rose-deep underline decoration-rose/30 underline-offset-4 transition-colors duration-200 hover:text-rose"
          >
            Log in
          </Link>
          .
        </>
      }
    >
      <PlaceholderForm mode="register" />
    </AuthShell>
  );
}
