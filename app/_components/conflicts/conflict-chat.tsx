"use client";

import { useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  ArrowRightIcon,
  InfoIcon,
  LockIcon,
  SendIcon,
  ShieldIcon,
} from "@/app/_components/icons";
import { Button } from "@/app/_components/ui/button";
import { ApiClientError, postJson } from "@/lib/api/client";
import type { Message, SendMessageResult } from "@/lib/types/message.types";
import type { SummaryResponse } from "@/lib/types/perspective.types";
import { cx } from "@/lib/utils/cx";

import { ConflictSummary } from "./conflict-summary";

type ConflictChatProps = {
  conflictId: string;
  initialMessages: Message[];
  initialSummary: string | null;
};

const WORD_STAGGER_MS = 24;
const MAX_REVEAL_MS = 900;
const MIN_USER_MESSAGES = 5;

function tokenizeForReveal(text: string) {
  let wordIndex = -1;

  return text.split(/(\s+)/).map((token) => {
    if (token.length === 0 || /^\s+$/.test(token)) {
      return { text: token, wordIndex: null };
    }

    wordIndex += 1;

    return { text: token, wordIndex };
  });
}

function RevealText({ text }: { text: string }) {
  const tokens = tokenizeForReveal(text);
  const wordCount = tokens.reduce(
    (count, token) => (token.wordIndex === null ? count : count + 1),
    0,
  );
  const stagger =
    wordCount > 0 ? Math.min(WORD_STAGGER_MS, MAX_REVEAL_MS / wordCount) : 0;

  return (
    <>
      {tokens.map((token, index) =>
        token.wordIndex === null ? (
          <Fragment key={index}>{token.text}</Fragment>
        ) : (
          <span
            key={index}
            className="reveal-word"
            style={{ animationDelay: `${token.wordIndex * stagger}ms` }}
          >
            {token.text}
          </span>
        ),
      )}
    </>
  );
}

function MessageBubble({
  message,
  reveal = false,
}: {
  message: Message;
  reveal?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <article
      aria-label={isUser ? "Your message" : "Mediator message"}
      className={cx("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cx(
          "max-w-[88%] whitespace-pre-wrap break-words rounded-3xl px-5 py-3 text-sm leading-6 sm:max-w-[80%]",
          isUser
            ? "rounded-br-lg bg-rose text-bone"
            : "rounded-bl-lg border border-line bg-paper text-ink-soft",
        )}
      >
        {reveal ? <RevealText text={message.content} /> : message.content}
      </div>
    </article>
  );
}

function TypingIndicator() {
  return (
    <div role="status" className="flex justify-start">
      <span className="sr-only">The mediator is typing…</span>
      <div
        aria-hidden="true"
        className="flex items-center gap-1 rounded-3xl rounded-bl-lg border border-line bg-paper px-5 py-4"
      >
        <span className="typing-dot size-1.5 rounded-full bg-muted" />
        <span className="typing-dot size-1.5 rounded-full bg-muted" />
        <span className="typing-dot size-1.5 rounded-full bg-muted" />
      </div>
    </div>
  );
}

export function ConflictChat({
  conflictId,
  initialMessages,
  initialSummary,
}: ConflictChatProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safetyNotice, setSafetyNotice] = useState<string | null>(null);
  const [readyToSummarize, setReadyToSummarize] = useState(false);
  const [revealId, setRevealId] = useState<number | null>(null);
  const [summary, setSummary] = useState<string | null>(initialSummary);

  const trimmedDraft = draft.trim();
  const canSend = trimmedDraft.length > 0 && !pending && !summarizing;
  const userMessageCount = messages.reduce(
    (count, message) => (message.role === "user" ? count + 1 : count),
    0,
  );
  const showSummaryCta =
    summary === null &&
    !pending &&
    (userMessageCount >= MIN_USER_MESSAGES || readyToSummarize);

  useEffect(() => {
    const scrollArea = scrollRef.current;

    if (scrollArea) {
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }, [messages.length, pending]);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  }, [draft]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (sendingRef.current || !trimmedDraft || summarizing) {
      return;
    }

    sendingRef.current = true;
    setPending(true);
    setError(null);
    setDraft("");

    const content = trimmedDraft;
    const tempId = -Date.now();

    setMessages((current) => [
      ...current,
      {
        id: tempId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const result = await postJson<SendMessageResult>(
        `/api/conflicts/${conflictId}/messages`,
        { content },
      );

      setMessages((current) => [
        ...current.filter((message) => message.id !== tempId),
        result.userMessage,
        result.assistantMessage,
      ]);
      setRevealId(result.assistantMessage.id);

      if (result.safetyNotice) {
        setSafetyNotice(result.safetyNotice.message);
      }

      if (result.readyToSummarize) {
        setReadyToSummarize(true);
      }
    } catch (requestError) {
      setMessages((current) =>
        current.filter((message) => message.id !== tempId),
      );
      setDraft((current) => (current.trim() ? current : content));

      if (requestError instanceof ApiClientError) {
        if (requestError.status === 401) {
          router.replace("/login");
          return;
        }

        if (requestError.status === 409) {
          setError(requestError.message);
          router.refresh();
          return;
        }

        setError(requestError.message);
        return;
      }

      setError("Couldn’t reach the mediator. Please try again.");
    } finally {
      sendingRef.current = false;
      setPending(false);
    }
  }

  async function handleMoveToNextStage() {
    if (summarizing) {
      return;
    }

    setSummarizing(true);
    setError(null);

    try {
      const result = await postJson<SummaryResponse>(
        `/api/conflicts/${conflictId}/perspective/summary/generate`,
        {},
      );

      setSummary(result.summary);
      router.refresh();
    } catch (requestError) {
      if (requestError instanceof ApiClientError) {
        if (requestError.status === 401) {
          router.replace("/login");
          return;
        }

        if (requestError.status === 409) {
          setError(requestError.message);
          router.refresh();
          return;
        }

        setError(requestError.message);
        return;
      }

      setError("Couldn’t create your summary. Please try again.");
    } finally {
      setSummarizing(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();

      if (canSend) {
        formRef.current?.requestSubmit();
      }
    }
  }

  if (summary !== null) {
    return (
      <ConflictSummary conflictId={conflictId} initialSummary={summary} />
    );
  }

  return (
    <section
      aria-labelledby="conversation-heading"
      className="mt-8 overflow-hidden rounded-[2rem] border border-line bg-paper shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-4 sm:px-7">
        <h2
          id="conversation-heading"
          className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-deep"
        >
          <LockIcon className="size-4" />
          Private conversation
        </h2>
        <p className="text-xs leading-5 text-muted">
          Only you and the mediator can read this.
        </p>
      </div>

      <div
        ref={scrollRef}
        aria-live="polite"
        className="flex max-h-[52svh] min-h-[18rem] flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-2 py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-rose-soft text-rose-deep">
              <LockIcon className="size-5" />
            </span>
            <h3 className="mt-5 font-display text-2xl tracking-[-0.03em] text-ink">
              Only you can see this.
            </h3>
            <p className="mt-3 max-w-sm text-pretty text-sm leading-6 text-muted">
              Start with what happened, in your own words. The mediator will
              help you separate the facts from the feeling underneath.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              reveal={message.id === revealId}
            />
          ))
        )}

        {pending ? <TypingIndicator /> : null}
      </div>

      <div className="border-t border-line bg-bone/40 px-4 py-4 sm:px-6">
        {safetyNotice ? (
          <div
            role="alert"
            className="mb-3 flex items-start gap-3 rounded-2xl border border-rose/20 bg-rose-soft/60 px-4 py-3"
          >
            <ShieldIcon className="mt-0.5 size-5 shrink-0 text-rose-deep" />
            <p className="text-sm leading-6 text-rose-deep">
              {safetyNotice}
            </p>
            <button
              type="button"
              onClick={() => setSafetyNotice(null)}
              aria-label="Dismiss safety notice"
              className="-mr-1 ml-auto flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-lg leading-none text-rose-deep transition-colors duration-150 ease-out-strong hover:bg-rose/10"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mb-3 flex items-start gap-2.5 rounded-xl border border-rose/20 bg-rose-soft/50 px-3.5 py-3 text-xs leading-5 text-rose-deep"
          >
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {showSummaryCta ? (
          <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-sage/20 bg-sage-soft/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-sage">
              <span className="font-medium">
                {readyToSummarize
                  ? "You’ve covered the ground."
                  : "You’ve shared enough to start."}
              </span>{" "}
              Your summary is the next step — you’ll be able to edit it before
              anything is shared.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={handleMoveToNextStage}
              disabled={summarizing}
              aria-busy={summarizing}
              className="shrink-0 self-start sm:self-auto"
            >
              <ArrowRightIcon className="size-4" />
              {summarizing ? "Creating summary…" : "Move to next stage"}
            </Button>
          </div>
        ) : null}

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          aria-busy={pending || summarizing}
        >
          <label htmlFor="message" className="sr-only">
            Your message
          </label>
          <div className="flex items-end gap-2 rounded-[1.5rem] border border-line bg-paper p-2 pl-4 transition-[border-color,box-shadow] duration-200 ease-out-strong focus-within:border-rose/30 focus-within:shadow-[0_0_0_4px_var(--color-rose-soft)]">
            <textarea
              ref={textareaRef}
              id="message"
              name="message"
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                summarizing
                  ? "Creating your summary…"
                  : pending
                    ? "The mediator is reading…"
                    : "Say what happened, in your words…"
              }
              autoComplete="off"
              className="max-h-36 min-h-10 flex-1 resize-none bg-transparent py-2.5 text-sm leading-6 text-ink outline-none placeholder:text-muted/70"
            />
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-rose text-bone transition-[background-color,transform,opacity] duration-150 ease-out-strong hover:bg-rose-deep focus-visible:outline-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            >
              <SendIcon className="size-4" />
            </button>
          </div>
          <p className="mt-2.5 px-1 text-[11px] leading-5 text-muted">
            Enter to send · Shift + Enter for a new line
          </p>
        </form>
      </div>
    </section>
  );
}
