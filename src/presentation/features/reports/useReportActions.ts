import React from "react";
import { Alert, Linking, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { fetchReportDownloadUrl } from "@/application/queries";
import { apiUrl, getAuthToken } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { UserReportWire } from "@/infrastructure/http";
import {
  fullStatementLabel,
  periodLabel,
} from "./statementFormat";

const PDF_MAGIC = "%PDF-";

async function assertPdfFile(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error("Statement file did not save to device");
  }
  if ((info.size ?? 0) < 100) {
    throw new Error("Statement file looks empty");
  }
  const head = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
    length: 8,
    position: 0,
  }).catch(() => null);
  if (head && !head.startsWith(PDF_MAGIC)) {
    throw new Error("Downloaded file is not a valid PDF");
  }
}

async function streamToCache(report: UserReportWire): Promise<string> {
  const token = getAuthToken();
  const safeName = fullStatementLabel(report).replace(/[^\w]+/g, "_");
  const target = `${FileSystem.cacheDirectory}Loupe_Statement_${safeName}.pdf`;
  const res = await FileSystem.downloadAsync(
    apiUrl(ENDPOINTS.reports.file(report.id)),
    target,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (res.status !== 200) {
    throw new Error(`Download failed (${res.status})`);
  }
  await assertPdfFile(res.uri);
  return res.uri;
}

async function downloadAndShareViaStream(report: UserReportWire): Promise<void> {
  const uri = await streamToCache(report);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: `Loupe statement · ${fullStatementLabel(report)}`,
    });
  } else {
    await Linking.openURL(uri);
  }
}

async function openPresignedUrl(url: string): Promise<boolean> {
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      dismissButtonStyle: "done",
    });
    return true;
  } catch {
    const ok = await Linking.canOpenURL(url);
    if (ok) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  }
}

export function useReportActions() {
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [viewer, setViewer] = React.useState<{ uri: string; title: string } | null>(
    null,
  );

  const onView = React.useCallback(async (report: UserReportWire) => {
    if (report.status !== "ready") return;
    setBusyKey(`${report.id}:view`);
    try {
      // iOS: always stream + in-app viewer — most reliable path (auth /file).
      if (Platform.OS === "ios") {
        const uri = await streamToCache(report);
        setViewer({ uri, title: `${periodLabel(report)} Statement` });
        return;
      }

      const { download_url } = await fetchReportDownloadUrl(report.id);
      if (download_url) {
        const opened = await openPresignedUrl(download_url);
        if (opened) return;
      }

      await downloadAndShareViaStream(report);
    } catch (e) {
      Alert.alert(
        "Couldn't open statement",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusyKey(null);
    }
  }, []);

  const onSave = React.useCallback(async (report: UserReportWire) => {
    if (report.status !== "ready") return;
    setBusyKey(`${report.id}:save`);
    try {
      await downloadAndShareViaStream(report);
    } catch (e) {
      Alert.alert(
        "Download failed",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusyKey(null);
    }
  }, []);

  const isViewBusy = React.useCallback(
    (reportId: string) => busyKey === `${reportId}:view`,
    [busyKey],
  );

  const isSaveBusy = React.useCallback(
    (reportId: string) => busyKey === `${reportId}:save`,
    [busyKey],
  );

  return {
    onView,
    onSave,
    busyKey,
    viewer,
    setViewer,
    isViewBusy,
    isSaveBusy,
  };
}

/** @internal — exported for unit tests */
export const __reportActionsTest = {
  assertPdfFile,
  streamToCache,
};
