import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchHardwareStatus } from "@/api/forensicApi";
import { useScannerStore } from "@/store/scannerStore";

/**
 * Subscribes the UI to the JFM Scanner's live hardware status and mirrors the
 * transport into the Zustand store so other features can react synchronously.
 */
export function useScannerConnection() {
  const setTransport = useScannerStore((s) => s.setTransport);
  const query = useQuery({
    queryKey: ["hardware-status"],
    queryFn: fetchHardwareStatus,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (query.data) setTransport(query.data.transport);
  }, [query.data, setTransport]);

  return query;
}
