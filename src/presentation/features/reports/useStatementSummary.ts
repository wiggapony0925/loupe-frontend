import { useReports, useUpcomingReports } from "@/application/queries";
import type { UpcomingReportWire, UserReportWire } from "@/infrastructure/http";

function sortReportsNewestFirst(reports: UserReportWire[]): UserReportWire[] {
  return [...reports].sort((a, b) => b.period_start.localeCompare(a.period_start));
}

export function useStatementSummary() {
  const list = useReports();
  const upcoming = useUpcomingReports();

  const reports = list.data ?? [];
  const readyReports = sortReportsNewestFirst(
    reports.filter((r) => r.status === "ready"),
  );
  const latestReady = readyReports[0] ?? null;
  const latestReadyMonthly =
    readyReports.find((r) => r.period === "monthly") ?? null;
  const upcomingRows = upcoming.data ?? [];
  const nextMonthly = upcomingRows.find((r) => r.period === "monthly");
  const nextYearly = upcomingRows.find((r) => r.period === "yearly");

  return {
    loading: list.isLoading || upcoming.isLoading,
    reports,
    readyReports,
    latestReady,
    latestReadyMonthly,
    readyCount: readyReports.length,
    archiveCount: reports.length,
    nextMonthly,
    nextYearly,
  };
}

export type StatementSummary = ReturnType<typeof useStatementSummary> & {
  nextMonthly?: UpcomingReportWire;
};
