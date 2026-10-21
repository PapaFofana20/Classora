/**
 * Authentification et autorisation de l'API (portage des modules partagés
 * Deno). Le JWT Supabase est VÉRIFIÉ par Supabase Auth lui-même — jamais de
 * décodage base64 sans signature.
 */

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SERVICE_KEY } from "../config.js";

/** Client service_role — NE JAMAIS l'exposer au navigateur. */
export function serviceClient(options = {}) {
  if (!SERVICE_KEY) {
    throw new Error("Configuration serveur incomplète (SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: options.dbSchema ?? "public" },
  });
}

/** Vérifie le JWT d'un utilisateur connecté auprès de Supabase Auth. */
export async function getAuthenticatedUser(svc, req) {
  const jwt = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await svc.auth.getUser(jwt);
  if (error || !data?.user) return null;
  return data.user;
}

export async function getCallerProfile(svc, req) {
  const user = await getAuthenticatedUser(svc, req);
  if (!user) return null;
  const { data: profile, error } = await svc
    .from("profiles")
    .select("id, school_id, role, status, must_change_password, teacher_id, parent_id, student_id, email")
    .eq("id", user.id)
    .single();
  if (error || !profile) return null;
  return {
    id: profile.id,
    email: profile.email,
    schoolId: profile.school_id,
    role: profile.role,
    status: profile.status,
    teacherId: profile.teacher_id,
    parentId: profile.parent_id,
    studentId: profile.student_id,
    mustChangePassword: profile.must_change_password,
    appMetadata: user.app_metadata ?? {},
  };
}

/**
 * Exige un directeur ACTIF de sa propre école (school_id vient du profil).
 * Le statut est contrôlé ici : un compte désactivé ne doit plus gérer le
 * personnel (maj, réinitialisation, activation) même avec un JWT encore
 * valide — les RLS ferment déjà l'accès aux données, pas ces endpoints.
 */
export async function requireDirecteur(svc, req, res) {
  const caller = await getCallerProfile(svc, req);
  if (!caller) {
    unauthorized(res);
    return null;
  }
  if (caller.status !== "ACTIF") {
    forbidden(res, "Ce compte n'est plus actif. Contactez la direction de votre école.");
    return null;
  }
  if (caller.role !== "directeur" || caller.schoolId === null) {
    forbidden(res, "Seule la direction peut effectuer cette action.");
    return null;
  }
  return { caller };
}

/* ------------------------------------------------------------------ */
/* Journal d'audit (aucune donnée personnelle d'élève dans le payload)  */
/* ------------------------------------------------------------------ */

export async function audit(svc, entry) {
  try {
    await svc.from("audit_log").insert({
      school_id: entry.schoolId ?? null,
      actor_id: entry.actorId ?? null,
      actor_role: entry.actorRole ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      payload: entry.payload ?? {},
    });
  } catch {
    // L'audit ne doit jamais faire échouer l'opération métier.
  }
}

/* ------------------------------------------------------------------ */
/* Mots de passe temporaires (identiques à utils/password.ts au front)  */
/* ------------------------------------------------------------------ */

const PASSWORD_MIN = 8;
const READABLE = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

export function passwordError(value) {
  if (!value) return "Le mot de passe est obligatoire.";
  if (value.length < PASSWORD_MIN) return `Au moins ${PASSWORD_MIN} caractères.`;
  const missing = [];
  if (!/[a-z]/.test(value)) missing.push("une lettre minuscule");
  if (!/[A-Z]/.test(value)) missing.push("une lettre majuscule");
  if (!/\d/.test(value)) missing.push("un chiffre");
  if (missing.length) return `Il manque : ${missing.join(", ")}.`;
  return null;
}

export function generateTempPassword() {
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => READABLE[b % READABLE.length]);
  chars[0] = LOWER[bytes[0] % LOWER.length];
  chars[1] = UPPER[bytes[1] % UPPER.length];
  chars[2] = DIGITS[bytes[2] % DIGITS.length];
  chars[3] = LOWER[bytes[3] % LOWER.length];
  return chars.join("");
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const SN_PHONE_RE = /^(\+221)?\s?7[0678]\s?\d{3}\s?\d{2}\s?\d{2}$/;
