import { callFunction } from "@/lib/functions";
import type { PlatformStatus } from "@/types";

/**
 * État public de la plateforme (bandeau maintenance, inscriptions ouvertes,
 * délai de déconnexion admin). Repli local si l'API est injoignable : le site
 * public ne doit jamais être bloqué par cet appel.
 */
export const DEFAULT_PLATFORM_STATUS: PlatformStatus = {
  platformName: "Classora",
  supportEmail: "support@classora.sn",
  supportPhone: "",
  schoolYear: "2026-2027",
  registrationOpen: true,
  maintenanceMode: false,
  maintenanceMessage: "",
  sessionTimeoutMinutes: 60,
  migrationApplied: false,
};

export async function getPlatformStatus(): Promise<PlatformStatus> {
  try {
    return await callFunction<PlatformStatus>("platform-status", undefined, "GET");
  } catch {
    return { ...DEFAULT_PLATFORM_STATUS };
  }
}
