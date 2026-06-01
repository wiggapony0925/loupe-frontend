/**
 * Reports query + mutation hooks.
 *
 * `useReports()` lists every PDF statement on the signed-in user. The
 * row is the source of truth for "I have a statement for this period";
 * the binary lives in object storage and is fetched on demand via
 * `useReportDownloadUrl()` (returns a short-lived presigned URL when
 * available, otherwise the caller can fall back to the streaming
 * `/v1/reports/{id}/file` endpoint).
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type {
  ReportDownloadWire,
  ReportGenerateWire,
  UpcomingReportWire,
  UserReportWire,
} from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

export function useReports() {
  return useQuery<UserReportWire[]>({
    queryKey: queryKeys.reports.list(),
    queryFn: () => apiFetch<UserReportWire[]>(ENDPOINTS.reports.list),
    staleTime: 30_000,
  });
}

/**
 * When the next monthly + yearly statements will auto-close.
 *
 * Statements are server-generated on a cycle (1st of month, 1st of
 * year). The UI uses this to render "Your next statement closes on…"
 * instead of a Generate button. Cheap endpoint — fine to refetch on
 * focus / poll.
 */
export function useUpcomingReports() {
  return useQuery<UpcomingReportWire[]>({
    queryKey: queryKeys.reports.upcoming(),
    queryFn: () => apiFetch<UpcomingReportWire[]>(ENDPOINTS.reports.upcoming),
    staleTime: 5 * 60_000,
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation<UserReportWire, Error, ReportGenerateWire>({
    mutationFn: (payload) =>
      apiFetch<UserReportWire>(ENDPOINTS.reports.create, {
        method: "POST",
        json: payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.reports.all });
    },
  });
}

/**
 * Fetches a fresh presigned URL each invocation (not cached) — callers
 * should pass the returned URL straight to `Linking.openURL()` or a
 * download library. We don't use `useQuery` because URLs are short-lived
 * and we always want a new one on tap.
 */
export async function fetchReportDownloadUrl(
  reportId: string,
): Promise<ReportDownloadWire> {
  return apiFetch<ReportDownloadWire>(ENDPOINTS.reports.download(reportId));
}
