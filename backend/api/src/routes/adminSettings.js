/**
 * Paramètres généraux de la plateforme : lecture pour tous les agents,
 * modification réservée au superadministrateur. Chaque modification est
 * journalisée dans audit_log.
 */
import { auditAdmin, requireAdminRole, requireSuperAdmin, serviceClient } from "../lib/authAdmin.js";
import { badRequest, ok, route, serverError, RATE_LIMIT_RE } from "../lib/http.js";
import { readPlatformSettings } from "../lib/platformSettings.js";
import { enforceRateLimit } from "../lib/rateLimit.js";
import { bool, expectObject, optionalString, requireEmail, requireString, ValidationError } from "../lib/validate.js";

const SCHOOL_YEAR_RE = /^\d{4}-\d{4}$/;
const SN_PHONE_RE = /^(\+221)?\s?7[0678]\s?\d{3}\s?\d{2}\s?\d{2}$/;

function requireInt(body, field, label, min, max) {
  const raw = body[field];
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError(`${label} doit être un entier entre ${min} et ${max}.`);
  }
  return n;
}

export default route(async (req, res) => {
  const svc = serviceClient();

  if (req.method === "GET") {
    const admin = await requireAdminRole(svc, req, res);
    if (!admin) return;
    const { caller } = admin;

    await enforceRateLimit(svc, `admin-settings-read:${caller.id}`, 60, 300);

    const { settings, migrationApplied, updatedAt, updatedBy } = await readPlatformSettings(svc);

    let updatedByName = null;
    if (updatedBy) {
      const { data: agent } = await svc
        .from("admin_agents")
        .select("first_name, last_name")
        .eq("auth_user_id", updatedBy)
        .maybeSingle();
      if (agent) updatedByName = `${agent.first_name} ${agent.last_name}`.trim();
    }

    return ok(res, {
      settings,
      migrationApplied,
      updatedAt,
      updatedByName,
      canEdit: caller.role === "superadmin",
    });
  }

  if (req.method === "PATCH") {
    const admin = await requireSuperAdmin(svc, req, res);
    if (!admin) return;
    const { caller, agent } = admin;

    await enforceRateLimit(svc, `admin-settings-write:${caller.id}`, 20, 300);

    const body = expectObject(req.body);
    const patch = {};
    const changes = {};

    if (body.platformName !== undefined) {
      patch.platform_name = requireString(body, "platformName", "Le nom de la plateforme", { min: 2, max: 60 });
      changes.platformName = patch.platform_name;
    }
    if (body.supportEmail !== undefined) {
      patch.support_email = requireEmail(body, "supportEmail");
      changes.supportEmail = patch.support_email;
    }
    if (body.supportPhone !== undefined) {
      const phone = optionalString(body, "supportPhone", "Le téléphone du support", 30) ?? "";
      if (phone && !SN_PHONE_RE.test(phone)) {
        throw new ValidationError("Le téléphone du support est invalide (format 7X XXX XX XX).");
      }
      patch.support_phone = phone;
      changes.supportPhone = phone;
    }
    if (body.schoolYear !== undefined) {
      const year = requireString(body, "schoolYear", "L'année scolaire", { min: 9, max: 9 });
      if (!SCHOOL_YEAR_RE.test(year)) throw new ValidationError("L'année scolaire doit être au format 2026-2027.");
      patch.school_year = year;
      changes.schoolYear = year;
    }
    if (body.registrationOpen !== undefined) {
      patch.registration_open = bool(body, "registrationOpen", true);
      changes.registrationOpen = patch.registration_open;
    }
    if (body.maintenanceMode !== undefined) {
      patch.maintenance_mode = bool(body, "maintenanceMode", false);
      changes.maintenanceMode = patch.maintenance_mode;
    }
    if (body.maintenanceMessage !== undefined) {
      patch.maintenance_message = optionalString(body, "maintenanceMessage", "Le message de maintenance", 300) ?? "";
      changes.maintenanceMessage = patch.maintenance_message;
    }
    if (body.sessionTimeoutMinutes !== undefined) {
      patch.session_timeout_minutes = requireInt(body, "sessionTimeoutMinutes", "Le délai de déconnexion", 5, 480);
      changes.sessionTimeoutMinutes = patch.session_timeout_minutes;
    }
    if (body.auditRetentionDays !== undefined) {
      patch.audit_retention_days = requireInt(body, "auditRetentionDays", "La durée de conservation", 30, 3650);
      changes.auditRetentionDays = patch.audit_retention_days;
    }

    if (Object.keys(patch).length === 0) {
      return badRequest(res, "Aucune modification fournie.");
    }

    // Cohérence maintenance : un message est nécessaire pour informer les écoles.
    const current = await readPlatformSettings(svc);
    if (!current.migrationApplied) {
      return ok(res, {
        error:
          "La migration 00031 n'est pas appliquée : la table platform_settings est absente. Exécutez le fichier backend/supabase/migrations/20260101000031_platform_settings.sql dans le SQL Editor Supabase.",
      }, 409);
    }
    const effectiveMaintenance = changes.maintenanceMode ?? current.settings.maintenanceMode;
    const effectiveMessage = changes.maintenanceMessage ?? current.settings.maintenanceMessage;
    if (effectiveMaintenance && !effectiveMessage.trim()) {
      return badRequest(res, "Renseignez un message de maintenance : il sera affiché aux établissements.");
    }

    patch.updated_at = new Date().toISOString();
    patch.updated_by = caller.id;

    const { error } = await svc.from("platform_settings").upsert({ id: 1, ...patch }, { onConflict: "id" });
    if (error) {
      console.error("[admin-settings] update", error);
      return serverError(res);
    }

    await auditAdmin(svc, {
      actorId: caller.id,
      actorRole: agent.role,
      action: "platform_settings_updated",
      entity: "platform_settings",
      entityId: null,
      payload: changes,
    });

    const { settings, updatedAt } = await readPlatformSettings(svc);
    return ok(res, {
      settings,
      updatedAt,
      updatedByName: `${agent.firstName} ${agent.lastName}`.trim(),
      message: "Paramètres enregistrés.",
    });
  }

  return ok(res, { error: "Méthode non autorisée." }, 405);
});
