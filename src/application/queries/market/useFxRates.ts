/**
 * useFxRatesSync — pull the server FX table into the fx store.
 *
 * Mounted ONCE at the root layout (alongside `useCurrencyProfileSync`).
 * The backend caches rates fleet-wide for 12 h, so a 6 h client staleTime
 * keeps every device within one refresh of the same table. Failures are
 * silent: `useMoney` falls back to the static snapshot.
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { useFxStore, type FxRatesDoc } from "@/application/stores/fxStore";

export function useFxRatesSync() {
  const setRates = useFxStore((s) => s.setRates);
  const q = useQuery({
    queryKey: ["fx", "rates"],
    queryFn: () => apiFetch<FxRatesDoc>(ENDPOINTS.market.fxRates),
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
  });

  useEffect(() => {
    if (q.data?.rates && Object.keys(q.data.rates).length > 0) {
      setRates(q.data);
    }
  }, [q.data, setRates]);
}
