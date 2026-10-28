/**
 * Lecture des paramètres généraux de la plateforme (migration 00031).
 *
 * Le déploiement peut précéder l'application de la migration : dans ce cas on
 * renvoie des valeurs par défaut SÛRES (inscriptions ouvertes, pas de
 * maintenance) plutôt que de casser les pages qui les consultent.
 */

export const DEFAULT_PLATFORM_SETTINGS = {
  platformName: "Classora",
  supportEmail: "support@classora.sn",
  supportPhone: "",
  schoolYear: "2026-2027",
  registrationOpen: true,
  maintenanceMode: false,
  maintenanceMessage: "",
  sessionTimeoutMinutes: 60,
  auditRetentionDays: 365,
};

const TABLE_MISSING_RE = /does not exist|schema cache|relation .* not found|Could not find the table/i;

function mapRow(row) {
  if (!row) return null;
  return {
    platformName: row.platform_name,
    supportEmail: row.support_email,
    supportPhone: row.support_phone ?? "",
    schoolYear: row.school_year,
    registrationOpen: row.registration_open === true,
    maintenanceMode: row.maintenance_mode === true,
    maintenanceMessage: row.maintenance_message ?? "",
    sessionTimeoutMinutes: Number(row.session_timeout_minutes ?? 60),
    auditRetentionDays: Number(row.audit_retention_days ?? 365),
  };
}

/**
 * Renvoie { settings, migrationApplied, updatedAt, updatedBy }.
 * Ne lève jamais pour une table absente : le reste de l'application continue.
 */
export async function readPlatformSettings(svc) {
  const { data, error } = await svc
    .from("platform_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    if (TABLE_MISSING_RE.test(error.message ?? "")) {
      return {
        settings: { ...DEFAULT_PLATFORM_SETTINGS },
        migrationApplied: false,
        updatedAt: null,
        updatedBy: null,
      };
    }
    throw new Error("Impossible de charger les paramètres de la plateforme.");
  }

  return {
    settings: mapRow(data) ?? { ...DEFAULT_PLATFORM_SETTINGS },
    migrationApplied: true,
    updatedAt: data?.updated_at ?? null,
    updatedBy: data?.updated_by ?? null,
  };
}

/** Sous-ensemble public (aucune donnée sensible). */
export function publicPlatformStatus(settings) {
  return {
    platformName: settings.platformName,
    schoolYear: settings.schoolYear,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    registrationOpen: settings.registrationOpen,
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
  };
}

export { mapRow as mapPlatformSettingsRow };
