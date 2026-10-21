import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SessionUser } from "@/types";
import * as authService from "@/services/authService";
import { resetDatabase } from "@/services/db";
import type { DirectorInput, ParentSignupInput, StaffAccountInput, StaffCredentials, StudentSignupInput } from "@/services/authService";

interface AuthContextValue {
  user: SessionUser | null;
  /** Vrai tant que la session n'a pas été restaurée depuis Supabase. */
  loadingSession: boolean;
  /** École de la session : toutes les lectures de données passent par cet identifiant. */
  schoolId: string;
  /** Vrai juste après une déconnexion : on retourne alors sur la landing page. */
  justLoggedOut: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  registerDirector: (input: DirectorInput) => Promise<SessionUser>;
  registerStudent: (input: StudentSignupInput) => Promise<SessionUser>;
  registerParent: (input: ParentSignupInput) => Promise<{ user: SessionUser; childName: string }>;
  changePassword: (current: string, next: string) => Promise<void>;
  createStaffAccount: (input: StaffAccountInput) => Promise<StaffCredentials>;
  refresh: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [justLoggedOut, setJustLoggedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await authService.currentSession();
        if (!cancelled) setUser(session);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await authService.login(email, password);
    setUser(u);
    setJustLoggedOut(false);
    return u;
  }, []);

  const registerDirector = useCallback(async (input: DirectorInput) => {
    const u = await authService.registerDirector(input);
    setUser(u);
    setJustLoggedOut(false);
    return u;
  }, []);

  const registerStudent = useCallback(async (input: StudentSignupInput) => {
    const { user: u } = await authService.registerStudent(input);
    setUser(u);
    setJustLoggedOut(false);
    return u;
  }, []);

  const registerParent = useCallback(async (input: ParentSignupInput) => {
    const { user: u, childName } = await authService.registerParent(input);
    setUser(u);
    setJustLoggedOut(false);
    return { user: u, childName };
  }, []);

  const changePassword = useCallback(
    async (current: string, next: string) => {
      if (!user) throw new Error("Aucun utilisateur connecté.");
      await authService.changePassword(user, current, next);
      const fresh = await authService.currentSession();
      if (fresh) setUser(fresh);
    },
    [user],
  );

  const createStaffAccount = useCallback(
    async (input: StaffAccountInput) => {
      if (!user) throw new Error("Aucun utilisateur connecté.");
      return authService.createStaffAccount(user, input);
    },
    [user],
  );

  /** Recharge la session (après un changement de mot de passe ou une décision de la direction). */
  const refresh = useCallback(async () => {
    const stored = await authService.currentSession();
    if (stored) setUser(stored);
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    void resetDatabase();
    setJustLoggedOut(true);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loadingSession, schoolId: user?.schoolId ?? "", justLoggedOut, login, registerDirector, registerStudent, registerParent, changePassword, createStaffAccount, refresh, logout }),
    [user, loadingSession, justLoggedOut, login, registerDirector, registerStudent, registerParent, changePassword, createStaffAccount, refresh, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>.");
  return ctx;
}

export function useCurrentUser(): SessionUser {
  const { user } = useAuth();
  if (!user) throw new Error("Aucun utilisateur connecté.");
  return user;
}
