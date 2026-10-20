import type { SchoolRegistrationRequest, SessionUser } from "@/types";
import { canApproveStudents } from "@/utils/permissions";
import { supabase } from "@/lib/supabase";
import { ensure } from "./access";
import { classesOf, db, hydrate, settingsOf } from "./db";
import { pendingCount } from "./access";

export interface RegistrationRequestRow extends SchoolRegistrationRequest {
  className: string;
  schoolName: string;
}

function withNames(schoolId: string, requests: SchoolRegistrationRequest[]): RegistrationRequestRow[] {
  const classes = classesOf(schoolId);
  return requests.map((r) => ({
    ...r,
    className: classes.find((c) => c.id === r.classId)?.name ?? "—",
    schoolName: settingsOf(schoolId).name,
  }));
}

/** Demandes en attente de validation, uniquement celles de l'école (RLS). */
export function listPending(actor: SessionUser): Promise<RegistrationRequestRow[]> {
  return (async () => {
    ensure(canApproveStudents(actor.role), "Seule la direction valide les demandes d'inscription.");
    await hydrate("registrationRequests");
    const schoolId = actor.schoolId;
    return withNames(
      schoolId,
      db.registrationRequests
        .filter((r) => r.schoolId === schoolId && r.status === "EN_ATTENTE")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    );
  })();
}

/** Toutes les demandes (historique) de l'école. */
export function listAll(actor: SessionUser): Promise<RegistrationRequestRow[]> {
  return (async () => {
    await hydrate("registrationRequests");
    return withNames(
      actor.schoolId,
      db.registrationRequests
        .filter((r) => r.schoolId === actor.schoolId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  })();
}

export const countPendingFor = (schoolId: string): Promise<number> =>
  (async () => {
    await hydrate("registrationRequests");
    return pendingCount(schoolId);
  })();

/** Approbation : RPC transactionnelle (limite du forfait, échéancier, annonce). */
export function approve(actor: SessionUser, requestIds: string[]): Promise<number> {
  return (async () => {
    ensure(canApproveStudents(actor.role), "Seule la direction valide les demandes d'inscription.");
    if (!requestIds.length) throw new Error("Aucune demande à approuver.");
    const { data, error } = await supabase.rpc("decide_registration_requests", {
      p_ids: requestIds,
      p_approve: true,
    });
    if (error) throw new Error(error.message);
    await Promise.all([hydrate("registrationRequests"), hydrate("students"), hydrate("users"), hydrate("payments")]);
    return Number(data ?? requestIds.length);
  })();
}

export function reject(actor: SessionUser, requestIds: string[], reason?: string): Promise<number> {
  return (async () => {
    ensure(canApproveStudents(actor.role), "Seule la direction valide les demandes d'inscription.");
    if (!requestIds.length) throw new Error("Aucune demande à refuser.");
    const { data, error } = await supabase.rpc("decide_registration_requests", {
      p_ids: requestIds,
      p_approve: false,
      p_reason: reason?.trim() || null,
    });
    if (error) throw new Error(error.message);
    await Promise.all([hydrate("registrationRequests"), hydrate("users")]);
    return Number(data ?? requestIds.length);
  })();
}
