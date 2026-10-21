/**
 * Utilitaires serveur partagés des Edge Functions SCOLIA.
 * Vérification JWT, client service_role, garde directeurence, audit,
 * mots de passe temporaires (règles identiques à src/utils/password.ts).
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { forbidden, unauthorized } from "./http.ts";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

/** Client service_role — JAMAIS exposé au navigateur. */
export function serviceClient(options: { dbSchema?: string } = {}): SupabaseClient {
  if (!SERVICE_KEY) {
    throw new Error("Configuration serveur incomplète (service_role).");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: options.dbSchema ?? "public" },
  });
}

/** Vérifie le JWT d'un utilisateur connecté et renvoie son user Auth. */
export async function getAuthenticatedUser(svc: SupabaseClient, req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await svc.auth.getUser(jwt);
  if (error || !data?.user) return null;
  return data.user;
}

export interface Caller {
  id: string;
  email: string;
  schoolId: string | null;
  role: string | null;
  status: string | null;
  teacherId: string | null;
  parentId: string | null;
  studentId: string | null;
  mustChangePassword: boolean;
  appMetadata: Record<string, unknown>;
}

/** Profil de l'appelant, lu avec le service_role (aucune confiance au client). */
export async function getCallerProfile(svc: SupabaseClient, req: Request): Promise<Caller | null> {
  const user = await getAuthenticatedUser(svc, req);
  if (!user) return null;
  if (user.app_metadata.role) {
    // Le claim du JWT fait foi ; le profil est rechargé pour son état courant.
  }
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

/** Exige un directeur actif de sa propre école (school_id vient du profil). */
export async function requireDirecteur(
  svc: SupabaseClient,
  req: Request,
): Promise<{ caller: Caller } | Response> {
  const caller = await getCallerProfile(svc, req);
  if (!caller) return unauthorized();
  if (caller.role !== "directeur" || caller.schoolId === null) {
    return forbidden("Seule la direction peut effectuer cette action.");
  }
  return { caller };
}

/* ------------------------------------------------------------------ */
/* Journal d'audit (aucune donnée personnelle d'élève dans payload)      */
/* ------------------------------------------------------------------ */

export async function audit(
  svc: SupabaseClient,
  entry: {
    schoolId?: string | null;
    actorId?: string | null;
    actorRole?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
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
/* Mots de passe temporaires (identiques à utils/password.ts au front)    */
/* ------------------------------------------------------------------ */

const PASSWORD_MIN = 8;
const READABLE = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

export function passwordError(value: string): string | null {
  if (!value) return "Le mot de passe est obligatoire.";
  if (value.length < PASSWORD_MIN) return `Au moins ${PASSWORD_MIN} caractères.`;
  const missing: string[] = [];
  if (!/[a-z]/.test(value)) missing.push("une lettre minuscule");
  if (!/[A-Z]/.test(value)) missing.push("une lettre majuscule");
  if (!/\d/.test(value)) missing.push("un chiffre");
  if (missing.length) return `Il manque : ${missing.join(", ")}.`;
  return null;
}

export function generateTempPassword(): string {
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

/** E-mail normalisé : minuscules, trim. */
export const normalizeEmail = (v: string): string => v.trim().toLowerCase();
