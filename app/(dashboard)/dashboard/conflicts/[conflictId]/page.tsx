import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { ArrowLeftIcon } from "@/app/_components/icons";
import { ConflictTimeline } from "@/app/_components/conflicts/conflict-timeline";
import { ConflictWorkspace } from "@/app/_components/conflicts/conflict-workspace";
import { Container } from "@/app/_components/ui/section";
import { getServerAuthContext } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/errors";
import { getConflictDetail } from "@/lib/services/conflict.service";
import { listMessages } from "@/lib/services/message.service";
import type { ConflictDetail } from "@/lib/types/conflict.types";
import type { MessageList } from "@/lib/types/message.types";

type ConflictPageProps = {
  params: Promise<{ conflictId: string }>;
};

const loadConflict = cache(
  async (conflictId: string, coupleId: string, userId: string) =>
    getConflictDetail(conflictId, coupleId, userId),
);

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export async function generateMetadata({
  params,
}: ConflictPageProps): Promise<Metadata> {
  const { conflictId } = await params;
  const auth = await getServerAuthContext();

  if (!auth) {
    return { title: "Conflict" };
  }

  try {
    const conflict = await loadConflict(conflictId, auth.coupleId, auth.userId);

    return {
      title: conflict.title,
      description: "A private space to work through this together.",
    };
  } catch {
    return { title: "Conflict" };
  }
}

export default async function ConflictPage({ params }: ConflictPageProps) {
  const auth = await getServerAuthContext();

  if (!auth) {
    redirect("/login");
  }

  const { conflictId } = await params;

  let conflict: ConflictDetail;
  let messages: MessageList;

  try {
    [conflict, messages] = await Promise.all([
      loadConflict(conflictId, auth.coupleId, auth.userId),
      listMessages(conflictId, auth.coupleId, auth.userId),
    ]);
  } catch (error) {
    if (isApiError(error) && error.code === "CONFLICT_NOT_FOUND") {
      notFound();
    }

    throw error;
  }

  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full text-xs font-medium text-muted transition-colors duration-150 ease-out-strong hover:text-ink"
        >
          <ArrowLeftIcon className="size-3.5" />
          All conflicts
        </Link>

        <header className="mt-7">
          <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-deep">
            <span aria-hidden="true" className="h-px w-7 bg-rose/50" />
            Private space
          </p>
          <h1 className="mt-5 text-balance font-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.04] font-normal tracking-[-0.04em] text-ink">
            {conflict.title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Started{" "}
            <time dateTime={conflict.createdAt}>
              {dateFormatter.format(new Date(conflict.createdAt))}
            </time>
            . Everything here stays private until you choose to share it.
          </p>
        </header>

        <div className="mt-8 rounded-2xl border border-line bg-paper/60 px-4 py-5 sm:px-6">
          <ConflictTimeline status={conflict.status} />
        </div>

        <ConflictWorkspace
          conflict={conflict}
          initialMessages={messages.items}
        />
      </div>
    </Container>
  );
}
