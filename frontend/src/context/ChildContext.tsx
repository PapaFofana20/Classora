import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "./AuthContext";
import { listStudentRows, type StudentRow } from "@/services/studentService";

interface ChildContextValue {
  children: StudentRow[];
  activeChild: StudentRow | null;
  setActiveChildId: (id: string) => void;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const ChildContext = createContext<ChildContextValue | null>(null);
const STORAGE_KEY = "classora_active_child";

/** Sélecteur d'enfant : un compte parent, plusieurs enfants (cycles différents possibles). */
export function ChildProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isParent = user?.role === "parent";
  const state = useAsync<StudentRow[]>(() => (isParent && user ? listStudentRows(user) : Promise.resolve([])), [user?.id]);
  const [activeId, setActiveId] = useState<string>(() => sessionStorage.getItem(STORAGE_KEY) ?? "");
  const list = useMemo(() => state.data ?? [], [state.data]);
  const activeChild = list.find((c) => c.id === activeId) ?? list[0] ?? null;

  useEffect(() => {
    if (activeChild) sessionStorage.setItem(STORAGE_KEY, activeChild.id);
  }, [activeChild]);

  const value = useMemo(
    () => ({ children: list, activeChild, setActiveChildId: setActiveId, loading: state.loading, error: state.error, reload: state.reload }),
    [list, activeChild, state.loading, state.error, state.reload],
  );
  return <ChildContext.Provider value={value}>{children}</ChildContext.Provider>;
}

export function useChild(): ChildContextValue {
  const ctx = useContext(ChildContext);
  if (!ctx) throw new Error("useChild doit être utilisé dans <ChildProvider>.");
  return ctx;
}
