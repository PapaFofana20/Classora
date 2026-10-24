/**
 * Contexte d'authentification administrative Classora.
 * Distinct de AuthContext (écoles) : un agent admin n'est lié à aucune école.
 * La vérification passe par l'API backend (POST /admin/auth) qui contrôle
 * le profil admin_agents côté serveur.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AdminAgent } from "@/types";
import { verifyAdminSession } from "@/services/admin";

interface AdminAuthContextValue {
  agent: AdminAgent | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  verify: () => Promise<boolean>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [agent, setAgent] = useState<AdminAgent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { agent: a } = await verifyAdminSession();
        if (!cancelled) setAgent(a);
      } catch {
        if (!cancelled) setAgent(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const verify = useCallback(async (): Promise<boolean> => {
    try {
      const { agent: a } = await verifyAdminSession();
      setAgent(a);
      return true;
    } catch {
      setAgent(null);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setAgent(null);
    setLoading(false);
  }, []);

  const value = useMemo(
    () => ({
      agent,
      loading,
      isAdmin: !!agent,
      isSuperAdmin: agent?.role === "superadmin",
      verify,
      logout,
    }),
    [agent, loading, verify, logout],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth doit être utilisé dans <AdminAuthProvider>.");
  return ctx;
}