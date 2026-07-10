import React from "react";
import { PdfViewerSheet } from "@/presentation/components/PdfViewerSheet";
import { StatementsEntryCard } from "./StatementsEntryCard";
import { useStatementSummary } from "./useStatementSummary";
import { useReportActions } from "./useReportActions";

/** Analytics-mounted statements card with live view/save actions. */
export function StatementsAnalyticsCard() {
  const { latestReadyMonthly } = useStatementSummary();
  const { onView, onSave, viewer, setViewer, isViewBusy, isSaveBusy } =
    useReportActions();

  return (
    <>
      <StatementsEntryCard
        onViewLatest={
          latestReadyMonthly ? () => void onView(latestReadyMonthly) : undefined
        }
        onSaveLatest={
          latestReadyMonthly ? () => void onSave(latestReadyMonthly) : undefined
        }
        viewBusy={
          latestReadyMonthly ? isViewBusy(latestReadyMonthly.id) : false
        }
        saveBusy={
          latestReadyMonthly ? isSaveBusy(latestReadyMonthly.id) : false
        }
      />
      <PdfViewerSheet
        visible={viewer != null}
        uri={viewer?.uri ?? null}
        title={viewer?.title ?? "Statement"}
        onClose={() => setViewer(null)}
      />
    </>
  );
}
