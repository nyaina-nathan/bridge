import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { CoupleGate } from "@/app/_components/dashboard/couple-gate";
import { SignOutButton } from "@/app/_components/dashboard/sign-out-button";
import { Logo } from "@/app/_components/logo";
import { Container } from "@/app/_components/ui/section";
import { getServerAuthContext } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/errors";
import { getSession } from "@/lib/services/auth.service";
import type { AuthSession } from "@/lib/types/auth.types";

/**
 * Every dashboard route reads the session cookie and the couple's membership,
 * so the segment is allowed to block while it renders for the request.
 */
export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const auth = await getServerAuthContext();

  if (!auth) {
    redirect("/login");
  }

  let session: AuthSession;

  try {
    session = await getSession(auth.userId);
  } catch (error) {
    if (isApiError(error) && error.code === "UNAUTHORIZED") {
      redirect("/login");
    }

    throw error;
  }

  const memberCount = session.couple.members.length;

  return (
    <CoupleGate
      initialIsPaired={memberCount >= 2}
      initialMemberCount={memberCount}
      initialInviteCode={session.couple.inviteCode}
    >
      <header className="border-b border-line bg-bone/90">
        <Container className="flex h-[4.5rem] items-center justify-between gap-6">
          <Logo />
          <SignOutButton />
        </Container>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>
    </CoupleGate>
  );
}
