import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/app/_components/auth/auth-form";
import { AuthShell } from "@/app/_components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Bridge space.",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back."
      subtitle="Pick up where you left off. Your private space is waiting."
      footer={
        <>
          New here?{" "}
          <Link
            href="/register"
            className="font-medium text-rose-deep underline decoration-rose/30 underline-offset-4 transition-colors duration-200 hover:text-rose"
          >
            Create a space
          </Link>
          .
        </>
      }
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
