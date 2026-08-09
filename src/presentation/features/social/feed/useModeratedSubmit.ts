/**
 * useModeratedSubmit — the one way to publish user content from the app.
 *
 * **Why the policy is NOT here.** Screening runs on the BACKEND, in one
 * chokepoint (`app/social/services/safety.enforce`). That is not an
 * implementation detail, it's the security property: anything a client
 * decides can be skipped by talking to the API directly, so a client-side
 * check is theatre — and a second copy of the policy would drift from the
 * real one the day either changes. The server is the only thing that can
 * actually refuse.
 *
 * **So what is this for?** Consistency of the RESPONSE. Every publish
 * surface — post, comment, bio, avatar, shop review, collection name — can
 * come back refused, and without this each screen invents its own handling:
 * one shows a red toast, one silently fails, one leaves a spinner running.
 * This wraps any publish mutation and gives all of them the same behaviour:
 *
 *   • refused (422)  → `refusal` holds the server's own explanation, the
 *                      draft is KEPT so nothing the user wrote is lost, and
 *                      `onBlocked` fires for surfaces that want a sheet;
 *   • published      → `onDone` fires; the caller clears its draft;
 *   • anything else  → `error`, the ordinary failure path.
 *
 * Queued-for-review is deliberately INVISIBLE to the author: the post is
 * live, and telling someone "this is under review" for content that
 * published fine would be both untrue and chilling.
 */
import { useCallback, useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";

/** The server's contract for a refusal. 422 = the screen said no. */
const REFUSED_STATUS = 422;

export interface ModeratedSubmitOptions {
  /** Fired when the server refuses, with its explanation. */
  onBlocked?: (reason: string) => void;
  /** Fired when it publishes. */
  onDone?: () => void;
}

export interface ModeratedSubmit<TVars> {
  submit: (vars: TVars) => void;
  /** The server's explanation while a refusal is on screen; null otherwise. */
  refusal: string | null;
  /** Clear the refusal — call it when the user edits their draft. */
  dismiss: () => void;
  pending: boolean;
  /** A non-moderation failure (network, auth, …). */
  error: Error | null;
}

/**
 * Wrap any publish mutation.
 *
 * ```ts
 * const create = useCreatePost();
 * const { submit, refusal, dismiss, pending } = useModeratedSubmit(create, {
 *   onDone: () => router.back(),
 * });
 * ```
 */
export function useModeratedSubmit<TData, TVars>(
  mutation: UseMutationResult<TData, Error, TVars, unknown>,
  options: ModeratedSubmitOptions = {},
): ModeratedSubmit<TVars> {
  const [refusal, setRefusal] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const { onBlocked, onDone } = options;

  const submit = useCallback(
    (vars: TVars) => {
      setRefusal(null);
      setError(null);
      mutation.mutate(vars, {
        onSuccess: () => onDone?.(),
        onError: (err) => {
          const reason = refusalFrom(err);
          if (reason) {
            // The draft is intentionally left alone — a refusal that also
            // wipes what someone wrote is punitive, and most refusals are
            // one word away from fine.
            setRefusal(reason);
            onBlocked?.(reason);
            return;
          }
          setError(err);
        },
      });
    },
    [mutation, onBlocked, onDone],
  );

  return {
    submit,
    refusal,
    dismiss: useCallback(() => setRefusal(null), []),
    pending: mutation.isPending,
    error,
  };
}

/**
 * The server's explanation, if this error was a moderation refusal.
 *
 * Matches on STATUS, not on message text: the copy is the backend's to
 * change (and it does — each surface has its own wording), while 422 from
 * a publish endpoint is the stable contract.
 */
export function refusalFrom(err: unknown): string | null {
  const status = (err as { status?: number } | null)?.status;
  if (status !== REFUSED_STATUS) return null;
  const message = (err as { message?: string } | null)?.message;
  return (
    message?.trim() ||
    "That looks like it breaks the community rules. Try rewording it."
  );
}
