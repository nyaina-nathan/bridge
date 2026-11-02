import type { ReactNode } from "react";

import { SignOutButton } from "@/app/_components/dashboard/sign-out-button";
import { Logo } from "@/app/_components/logo";
import { Container } from "@/app/_components/ui/section";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-bone">
      <header className="border-b border-line bg-bone/90">
        <Container className="flex h-[4.5rem] items-center justify-between gap-6">
          <Logo />
          <SignOutButton />
        </Container>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
