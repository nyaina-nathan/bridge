"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { CheckIcon } from "@/app/_components/icons";
import { Button } from "@/app/_components/ui/button";
import type { AuthSession } from "@/lib/types/auth.types";

import { useSignOut } from "./use-sign-out";

const MEMBERSHIP_POLL_MS = 20_000;
const UNLOCK_EXIT_MS = 170;
const COPY_FEEDBACK_MS = 2_500;

type GateStatus = "waiting" | "leaving" | "paired";
type CopyStatus = "idle" | "copied" | "failed";

type CoupleGateProps = {
  initialIsPaired: boolean;
  initialMemberCount: number;
  initialInviteCode: string;
  children: ReactNode;
};

export function CoupleGate({
  initialIsPaired,
  initialMemberCount,
  initialInviteCode,
  children,
}: CoupleGateProps) {
  const router = useRouter();
  const { pending: signingOut, signOut } = useSignOut();

  const [status, setStatus] = useState<GateStatus>(
    initialIsPaired ? "paired" : "waiting",
  );
  const [memberCount, setMemberCount] = useState(initialMemberCount);
  const [inviteCode, setInviteCode] = useState(initialInviteCode);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [announceUnlocked, setAnnounceUnlocked] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<number | null>(null);

  const isGated = status !== "paired";
  const isLeaving = status === "leaving";

  const checkMembership = useCallback(
    async ({ manual = false }: { manual?: boolean } = {}) => {
      if (manual) {
        setIsChecking(true);
        setCheckError(false);
      }

      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          setCheckError(true);
          return;
        }

        const session = (await response.json()) as AuthSession;
        const members = session.couple?.members;

        if (!members) {
          setCheckError(true);
          return;
        }

        setCheckError(false);
        setMemberCount(members.length);
        setInviteCode(session.couple.inviteCode);

        if (members.length >= 2) {
          setStatus((current) =>
            current === "waiting" ? "leaving" : current,
          );
        }
      } catch {
        setCheckError(true);
      } finally {
        if (manual) {
          setIsChecking(false);
        }
      }
    },
    [router],
  );

  // Re-check while the gate is visible, but stay quiet in the background.
  useEffect(() => {
    if (status !== "waiting") {
      return;
    }

    const checkIfVisible = () => {
      if (document.visibilityState === "visible") {
        void checkMembership();
      }
    };

    const interval = window.setInterval(checkIfVisible, MEMBERSHIP_POLL_MS);

    window.addEventListener("focus", checkIfVisible);
    document.addEventListener("visibilitychange", checkIfVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checkIfVisible);
      document.removeEventListener("visibilitychange", checkIfVisible);
    };
  }, [checkMembership, status]);

  // Play the exit state before revealing the dashboard underneath.
  useEffect(() => {
    if (status !== "leaving") {
      return;
    }

    const timer = window.setTimeout(() => {
      setStatus("paired");
      setAnnounceUnlocked(true);
      router.refresh();

      window.requestAnimationFrame(() => {
        const main = document.getElementById("main");

        if (!main) {
          return;
        }

        main.setAttribute("tabindex", "-1");
        main.focus({ preventScroll: true });
        main.addEventListener(
          "blur",
          () => main.removeAttribute("tabindex"),
          { once: true },
        );
      });
    }, UNLOCK_EXIT_MS);

    return () => window.clearTimeout(timer);
  }, [router, status]);

  // Block the page behind the gate: no scroll, no tabbing, no Escape.
  useEffect(() => {
    if (!isGated) {
      return;
    }

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const panel = panelRef.current;

    const getFocusable = () => {
      if (!panel) {
        return [];
      }

      return Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
    };

    const firstFocusable = getFocusable()[0] ?? panel;
    window.requestAnimationFrame(() =>
      firstFocusable?.focus({ preventScroll: true }),
    );

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.key !== "Tab" || !panel) {
        return;
      }

      const focusable = getFocusable();

      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !panel.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [isGated]);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) {
        window.clearTimeout(copyTimer.current);
      }
    };
  }, []);

  async function handleCopy() {
    if (copyTimer.current !== null) {
      window.clearTimeout(copyTimer.current);
    }

    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }

    copyTimer.current = window.setTimeout(
      () => setCopyStatus("idle"),
      COPY_FEEDBACK_MS,
    );
  }

  return (
    <>
      <div
        className="flex min-h-svh flex-col bg-bone"
        inert={isGated || undefined}
        aria-hidden={isGated || undefined}
      >
        {children}
      </div>

      {isGated ? (
        <div className="gate-scrim fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-ink/35 backdrop-blur-[6px]">
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="couple-gate-title"
              aria-describedby="couple-gate-description"
              data-leaving={isLeaving ? "true" : undefined}
              tabIndex={-1}
              className="gate-panel w-full max-w-xl rounded-[2rem] border border-line bg-paper p-6 shadow-lift focus:outline-none sm:p-9"
            >
              <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-deep">
                <span aria-hidden="true" className="h-px w-7 bg-rose/50" />
                One more step
              </p>

              <h2
                id="couple-gate-title"
                className="mt-5 text-balance font-display text-[clamp(2rem,4.5vw,2.75rem)] leading-[1.03] font-normal tracking-[-0.04em] text-ink"
              >
                Invite your partner to open this space.
              </h2>

              <p
                id="couple-gate-description"
                className="mt-4 text-pretty text-sm leading-6 text-muted sm:text-base sm:leading-7"
              >
                Bridge is built for two. Share your invite code — once your
                partner creates their account with it, this dashboard unlocks
                on its own.
              </p>

              <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-rose"
                />
                {memberCount} of 2 joined
              </p>

              <div className="mt-6 rounded-2xl border border-line bg-bone px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                      Your invite code
                    </p>
                    <code className="mt-1.5 block select-all font-display text-[clamp(1.9rem,6vw,2.5rem)] leading-none tracking-[0.18em] text-ink">
                      {inviteCode}
                    </code>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={copyStatus === "copied" ? "secondary" : "primary"}
                    onClick={handleCopy}
                    className="w-full shrink-0 sm:w-auto"
                  >
                    {copyStatus === "copied" ? (
                      <>
                        <CheckIcon className="size-4" />
                        Copied
                      </>
                    ) : (
                      "Copy code"
                    )}
                  </Button>
                </div>

                <p className="mt-4 text-xs leading-5 text-muted">
                  Your partner enters this when they register. Only one other
                  person can join with it.
                </p>

                {copyStatus === "failed" ? (
                  <p className="mt-3 text-xs leading-5 text-rose-deep">
                    Couldn’t copy automatically. Select the code and copy it
                    manually.
                  </p>
                ) : null}
              </div>

              <p
                role="status"
                className="mt-5 text-xs leading-5 text-muted"
              >
                {checkError
                  ? "Couldn’t refresh just now. We’ll keep trying."
                  : isChecking
                    ? "Checking for your partner…"
                    : "Waiting for your partner to join."}
              </p>

              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  disabled={signingOut}
                  className="justify-start sm:justify-center"
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void checkMembership({ manual: true })}
                  disabled={isChecking}
                >
                  {isChecking ? "Checking…" : "Check again"}
                </Button>
              </div>

              <p className="sr-only" role="status" aria-live="polite">
                {copyStatus === "copied"
                  ? "Invite code copied."
                  : copyStatus === "failed"
                    ? "Couldn’t copy the invite code. Select the code and copy it manually."
                    : ""}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {announceUnlocked ? (
        <p className="sr-only" role="status" aria-live="polite">
          Your partner has joined. Your dashboard is unlocked.
        </p>
      ) : null}
    </>
  );
}
