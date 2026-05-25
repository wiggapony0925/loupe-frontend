import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchHardwareStatus } from "@/infrastructure/repositories/forensicRepository";
import { useScannerStore } from "@/application/stores/scannerStore";

/**
 * Subscribes the UI to the JFM Scanner's live hardware status and mirrors the
 * transport into the Zustand store so other features can react synchronously.
 */
export function useScannerConnection() {
  const setTransport = useScannerStore((s) => s.setTransport);
  const query = useQuery({
    queryKey: ["hardware-status"],
    queryFn: fetchHardwareStatus,
    // Poll once per minute. Was 5s, which produced 12 req/min/screen and
    // hammered Cloud Run when the widget mounted on multiple tabs.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (query.data) setTransport(query.data.transport);
  }, [query.data, setTransport]);

  return query;
}
