import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { Plan, School, SchoolSettings, SubscriptionStatus } from "@/types";
import { useAsync } from "@/hooks/useAsync";
import { getSchoolOverview } from "@/services/schoolService";
import { getStatus } from "@/services/subscriptionService";
import { useAuth } from "./AuthContext";

export interface SchoolState {
  schoolId: string;
  school: School | null;
  settings: SchoolSettings | null;
  status: SubscriptionStatus;
  /** Formule en cours. */
  plan: Plan | null;
  /** Date d'échéance de l'abonnement courant. */
  endsAt: string | null;
  /** Abonnement expiré depuis moins de 7 jours : consultation possible, écriture bloquée. */
  readOnly: boolean;
  /** Abonnement expiré depuis plus de 7 jours : accès fermé. */
  blocked: boolean;
  /** Aucun abonnement : seul l'écran d'abonnement et le profil sont accessibles. */
  missing: boolean;
  daysLeft: number;
  studentLimit: number | null;
  activeStudents: number;
  limitReached: boolean;
  loading: boolean;
  reload: () => void;
}

const EMPTY: SchoolState = {
  schoolId: "",
  school: null,
  settings: null,
  status: "AUCUN",
  plan: null,
  endsAt: null,
  readOnly: false,
  blocked: false,
  missing: true,
  daysLeft: 0,
  studentLimit: null,
  activeStudents: 0,
  limitReached: false,
  loading: true,
  reload: () => {},
};

interface SchoolContextValue extends SchoolState {
  /** Nom affiché dans la topbar et sur les documents. */
  schoolName: string;
}

const SchoolContext = createContext<SchoolContextValue | null>(null);

/**
 * École courante de la session : c'est le SEUL point d'accès aux données.
 * Le schoolId vient de la session (AuthContext), jamais d'un paramètre d'URL.
 */
export function SchoolProvider({ children }: { children: ReactNode }) {
  const { user, schoolId } = useAuth();
  const state = useAsync(async () => {
    if (!schoolId) return null;
    const [overview, info] = await Promise.all([getSchoolOverview(schoolId), getStatus(schoolId)]);
    return { overview, info };
  }, [schoolId]);

  const reload = useCallback(() => state.reload(), [state.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<SchoolContextValue>(() => {
    if (!user || !state.data) return { ...EMPTY, schoolId, schoolName: "", loading: state.loading, reload };
    const { overview, info } = state.data;
    return {
      schoolId,
      school: overview.school,
      settings: overview.settings,
      status: info.status,
      plan: info.plan,
      endsAt: info.subscription?.endsAt ?? null,
      readOnly: info.readOnly,
      blocked: info.blocked,
      missing: info.status === "AUCUN",
      daysLeft: info.daysLeft,
      studentLimit: info.studentLimit,
      activeStudents: info.activeStudents,
      limitReached: info.limitReached,
      loading: state.loading,
      reload,
      schoolName: overview.school?.name ?? overview.settings.name,
    };
  }, [user, state.data, state.loading, schoolId, reload]);

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}

export function useSchool(): SchoolContextValue {
  const ctx = useContext(SchoolContext);
  if (!ctx) throw new Error("useSchool doit être utilisé dans <SchoolProvider>.");
  return ctx;
}