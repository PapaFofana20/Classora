import { useState } from "react";
import type { Period } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { periodInfo } from "@/services/reportService";

/** Période d'évaluation sélectionnée (semestre / trimestre configuré dans les paramètres). */
export function usePeriods(): { periods: Period[]; period: string; setPeriod: (id: string) => void } {
  const { schoolId } = useAuth();
  const info = periodInfo(schoolId);
  const [period, setPeriod] = useState(info.current);
  return { periods: info.periods, period: info.periods.some((p) => p.id === period) ? period : info.current, setPeriod };
}