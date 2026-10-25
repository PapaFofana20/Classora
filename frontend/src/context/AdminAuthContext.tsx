/**
 * Contexte d'authentification administrative Classora.
 * Distinct de AuthContext (écoles) : un agent admin n'est lié à aucune école.
 * La vérification passe par l'API backend (POST /admin/auth) qui contrôle
 * le profil admin_agents côté serveur.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AdminAgent } from "@/types";
import { verifyAdminSession } from "@/services/admin";
import { supabase } from "@/lib/supabase";

export interface AdminVerifyResult {
  ok: boolean;
  /** Message serveur à afficher (profil absent, compte désactivé, API injoignable…). */
  error?: string;
}

interface AdminAuthContextValue {
  agent: AdminAgent | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  verify: () => Promise<AdminVerifyResult>;
  logout: () => Promise<void>;
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

  const verify = useCallback(async (): Promise<AdminVerifyResult> => {
    try {
      const { agent: a } = await verifyAdminSession();
      setAgent(a);
      return { ok: true };
    } catch (e) {
      setAgent(null);
      return { ok: false, error: e instanceof Error ? e.message : undefined };
    }
  }, []);

  /**
   * Ferme la session Supabase elle-même (pas seulement l'état React) : sans
   * cela, le JWT restait valide et un rechargement de /admin reconnectait
   * l'agent immédiatement.
   */
  const logout = useCallback(async () => {
    setAgent(null);
    setLoading(false);
    await supabase.auth.signOut();
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
