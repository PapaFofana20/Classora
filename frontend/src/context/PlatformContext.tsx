import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_PLATFORM_STATUS, getPlatformStatus } from "@/services/platform";
import type { PlatformStatus } from "@/types";

interface PlatformContextValue {
  status: PlatformStatus;
  loading: boolean;
  /** Recharge les réglages (après une modification dans /admin/parametres). */
  refresh: () => Promise<void>;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<PlatformStatus>(DEFAULT_PLATFORM_STATUS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await getPlatformStatus();
    setStatus(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPlatformStatus().then((next) => {
      if (!cancelled) {
        setStatus(next);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ status, loading, refresh }), [status, loading, refresh]);
  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatformStatus(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error("usePlatformStatus doit être utilisé dans <PlatformProvider>.");
  return ctx;
}
