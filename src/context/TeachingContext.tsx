import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTeacherAssignments, type TeacherContextItem } from "@/hooks/useTeacherAssignments";

type TeacherData = ReturnType<typeof useTeacherAssignments>;

interface TeachingContextValue extends TeacherData {
  /** Contexte actif "Classe · Matière" (professeur). */
  active: TeacherContextItem | null;
  setActiveKey: (key: string) => void;
}

const TeachingContext = createContext<TeachingContextValue | null>(null);
const STORAGE_KEY = "classora_active_context";

export function TeachingProvider({ children }: { children: ReactNode }) {
  const data = useTeacherAssignments();
  const [activeKey, setKey] = useState<string>(() => sessionStorage.getItem(STORAGE_KEY) ?? "");

  const active = useMemo(() => data.contexts.find((c) => c.key === activeKey) ?? data.contexts[0] ?? null, [data.contexts, activeKey]);
  useEffect(() => {
    if (active) sessionStorage.setItem(STORAGE_KEY, active.key);
  }, [active]);

  const setActiveKey = useCallback((key: string) => setKey(key), []);
  const value = useMemo(() => ({ ...data, active, setActiveKey }), [data, active, setActiveKey]);
  return <TeachingContext.Provider value={value}>{children}</TeachingContext.Provider>;
}

export function useTeaching(): TeachingContextValue {
  const ctx = useContext(TeachingContext);
  if (!ctx) throw new Error("useTeaching doit être utilisé dans <TeachingProvider>.");
  return ctx;
}
