import type { SchoolRegistrationRequest, SessionUser } from "@/types";
import { TODAY_ISO } from "@/data/school";
import { canApproveStudents } from "@/utils/permissions";
import { linkAccountToStudent } from "./authService";
import { ensure, ensureWritable, pendingCount } from "./access";
import { classesOf, db, persist, respond, settingsOf, uid } from "./db";
import { buildPaymentPlan } from "./paymentService";
import { subscriptionInfoOf } from "./subscriptionService";

export interface RegistrationRequestRow extends SchoolRegistrationRequest {
  className: string;
  schoolName: string;
}

/** Demandes en attente de validation, uniquement celles de l'école du directeur. */
export function listPending(actor: SessionUser): Promise<RegistrationRequestRow[]> {
  return respond(() => {
    ensure(canApproveStudents(actor.role), "Seule la direction valide les demandes d'inscription.");
    const schoolId = actor.schoolId;
    const classes = classesOf(schoolId);
    return db.registrationRequests
      .filter((r) => r.schoolId === schoolId && r.status === "EN_ATTENTE")
      .map((r) => ({
        ...r,
        className: classes.find((c) => c.id === r.classId)?.name ?? "—",
        schoolName: settingsOf(schoolId).name,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });
}

/** Toutes les demandes (historique) de l'école. */
export function listAll(actor: SessionUser): Promise<RegistrationRequestRow[]> {
  return respond(() => {
    const classes = classesOf(actor.schoolId);
    return db.registrationRequests
      .filter((r) => r.schoolId === actor.schoolId)
      .map((r) => ({ ...r, className: classes.find((c) => c.id === r.classId)?.name ?? "—", schoolName: settingsOf(actor.schoolId).name }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

export const countPendingFor = (schoolId: string): Promise<number> => respond(() => pendingCount(schoolId), 50, 150);

/** Message d'erreur quand la limite d'élèves du forfait est atteinte. */
function limitError(schoolId: string): string | null {
  const info = subscriptionInfoOf(schoolId);
  if (!info.limitReached || info.studentLimit === null) return null;
  return `Votre formule ${info.plan?.name ?? ""} est limitée à ${info.studentLimit} élèves. Changez de formule pour approuver une nouvelle inscription.`;
}

/** Approbation : la limite du forfait est contrôlée avant toute création d'élève. */
export function approve(actor: SessionUser, requestIds: string[]): Promise<number> {
  return respond(() => {
    ensure(canApproveStudents(actor.role), "Seule la direction valide les demandes d'inscription.");
    ensureWritable(actor);
    const requests = db.registrationRequests.filter((r) => r.schoolId === actor.schoolId && r.status === "EN_ATTENTE" && requestIds.includes(r.id));
    ensure(requests.length > 0, "Aucune demande à approuver.");
    if (requests.some((r) => r.role === "eleve")) {
      const full = limitError(actor.schoolId);
      if (full) throw new Error(full);
    }
    requests.forEach((r) => {
      if (r.role === "eleve") {
        const account = db.users.find((u) => u.id === r.userId);
        if (account && r.classId) {
          const student = linkAccountToStudent(account, r.classId, r.gender ?? "F", r.birthDate ?? "2015-01-01");
          db.payments.push(...buildPaymentPlan(student));
        }
      }
      r.status = "APPROUVEE";
      r.decidedAt = TODAY_ISO;
      const account = db.users.find((u) => u.id === r.userId);
      if (account) account.status = "ACTIF";
    });
    notify(requests, true);
    persist();
    return requests.length;
  });
}

export function reject(actor: SessionUser, requestIds: string[], reason?: string): Promise<number> {
  return respond(() => {
    ensure(canApproveStudents(actor.role), "Seule la direction valide les demandes d'inscription.");
    ensureWritable(actor);
    const requests = db.registrationRequests.filter((r) => r.schoolId === actor.schoolId && r.status === "EN_ATTENTE" && requestIds.includes(r.id));
    ensure(requests.length > 0, "Aucune demande à refuser.");
    requests.forEach((r) => {
      r.status = "REFUSEE";
      r.decidedAt = TODAY_ISO;
      if (reason?.trim()) r.reason = reason.trim();
      const account = db.users.find((u) => u.id === r.userId);
      if (account) account.status = "DESACTIVE";
    });
    notify(requests, false);
    persist();
    return requests.length;
  });
}

/** Annonce dans la messagerie de l'école : la direction est prévenue de chaque décision. */
function notify(requests: SchoolRegistrationRequest[], approved: boolean): void {
  db.announcements.unshift({
    schoolId: requests[0]?.schoolId ?? "",
    id: uid("an"),
    title: approved ? "Inscription(s) validée(s)" : "Inscription(s) refusée(s)",
    body: approved
      ? `${requests.length} demande(s) d'inscription validée(s). Les familles peuvent désormais se connecter.`
      : `${requests.length} demande(s) refusée(s). ${requests[0]?.reason ?? "Motif communiqué à la famille."}`,
    at: `${TODAY_ISO}T${new Date().toTimeString().slice(0, 5)}`,
    author: "Direction",
    audience: ["directeur"],
  });
}