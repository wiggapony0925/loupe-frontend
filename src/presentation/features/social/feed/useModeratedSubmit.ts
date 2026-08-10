/**
 * useModeratedSubmit — the one way to publish user content from the app.
 *
 * The implementation moved to the shared `moderato` package (vendored at
 * vendor/moderato, canonical source ../moderato — `npm run sync:moderato`),
 * where loupe-web uses the SAME hook for its composer, comments, and
 * profile surfaces. The contract is unchanged:
 *
 *   • the POLICY is not here — screening runs on the backend, in one
 *     chokepoint (`app/social/services/safety.enforce`); the server is the
 *     only thing that can actually refuse;
 *   • refused (422) → `refusal` holds the server's explanation, the draft
 *     is KEPT, `onBlocked` fires for surfaces that want a sheet;
 *   • published → `onDone`; anything else → `error`;
 *   • queued-for-review stays invisible to the author.
 */
export {
  refusalFrom,
  useModeratedSubmit,
} from "moderato/react";
export type {
  ModeratedSubmit,
  ModeratedSubmitOptions,
} from "moderato/react";
