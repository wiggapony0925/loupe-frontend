/**
 * PATCH /v1/me — display name and phone number.
 *
 * Not optimistic. The server normalises what it's given (every way a person
 * writes a phone number collapses to one E.164 string) and hands back the
 * MASKED form, so what returns is deliberately not what was typed. Painting
 * the raw input into the cache first would show "(415) 555-0123" for a beat
 * and then swap it for "+1 ••• ••• 0123", which reads as a glitch.
 *
 * A duplicate number comes back 409 — someone else already registered that
 * line. That's a real answer for the form to show, not a retry.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { MeResponse, UserProfileUpdate } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation<MeResponse, Error, UserProfileUpdate>({
    mutationFn: (body) =>
      apiFetch<MeResponse>(ENDPOINTS.me.root, { method: "PATCH", json: body }),
    onSuccess: (updated) => {
      // Seed rather than invalidate: the response IS the new profile, and a
      // refetch would only ask for what we're already holding.
      qc.setQueryData(queryKeys.me.profile(), updated);
    },
  });
}
