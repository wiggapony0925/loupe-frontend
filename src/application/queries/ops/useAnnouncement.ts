/**
 * Global announcement banner — the same `/v1/announcement` the web reads,
 * set from the dev dashboard. Public (no auth), polled every few minutes +
 * on focus so flipping it on in the dashboard reaches the app shortly after.
 * Best-effort: a network blip just returns the last-known value.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";

export type AnnouncementTone = "info" | "success" | "warning" | "error";

export interface AnnouncementWire {
  enabled: boolean;
  message: string;
  tone: AnnouncementTone;
  cta_label?: string | null;
  cta_href?: string | null;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useAnnouncement() {
  return useQuery<AnnouncementWire>({
    queryKey: ["announcement"],
    queryFn: () => apiFetch<AnnouncementWire>(ENDPOINTS.announcement),
    staleTime: FIVE_MINUTES_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
