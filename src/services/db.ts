import type {
  AbsenceRecord,
  Announcement,
  ClassRoom,
  ClassSubject,
  Conversation,
  Grade,
  Parent,
  Payment,
  ReportMeta,
  School,
  SchoolRegistrationRequest,
  SchoolSettings,
  Student,
  Subject,
  Subscription,
  Teacher,
  TeachingAssignment,
  User,
} from "@/types";
import { absences } from "@/data/absences";
import { assignments } from "@/data/assignments";
import { classes } from "@/data/classes";
import { classSubjects } from "@/data/classSubjects";
import { grades, reportMetas } from "@/data/grades";
import { announcements, conversations } from "@/data/messages";
import { payments } from "@/data/payments";
import { registrationRequests } from "@/data/registrationRequests";
import { schoolSettings, schools } from "@/data/schools";
import { subscriptions } from "@/data/subscriptions";
import { parents, students } from "@/data/students";
import { subjects } from "@/data/subjects";
import { teachers } from "@/data/teachers";
import { users } from "@/data/users";

/**
 * Base de données de démonstration, en mémoire et persistée dans localStorage.
 *
 * Toutes les collections pédagogiques portent un `schoolId` : les services ne
 * lisent jamais une ligne dont l'école diffère de celle de la session
 * (voir services/access.ts). Remplaçable par Supabase + RLS (SUPABASE_NOTES.md).
 */
export interface Database {
  schools: School[];
  subscriptions: Subscription[];
  registrationRequests: SchoolRegistrationRequest[];
  users: User[];
  teachers: Teacher[];
  parents: Parent[];
  students: Student[];
  classes: ClassRoom[];
  subjects: Subject[];
  classSubjects: ClassSubject[];
  assignments: TeachingAssignment[];
  grades: Grade[];
  reportMetas: ReportMeta[];
  payments: Payment[];
  conversations: Conversation[];
  announcements: Announcement[];
  absences: AbsenceRecord[];
  settings: SchoolSettings[];
}

const KEY = "classora_db_v3";

function seed(): Database {
  return structuredClone({
    schools,
    subscriptions,
    registrationRequests,
    users,
    teachers,
    parents,
    students,
    classes,
    subjects,
    classSubjects,
    assignments,
    grades,
    reportMetas,
    payments,
    conversations,
    announcements,
    absences,
    settings: schoolSettings,
  });
}

function load(): Database {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      if (parsed.students && parsed.settings.length && parsed.schools.length && parsed.subscriptions) return parsed;
    }
  } catch {
    /* données corrompues : on repart des données de démonstration */
  }
  return seed();
}

/** "Base de données" en mémoire, persistée dans localStorage. Remplaçable par une API REST / Supabase. */
export const db: Database = load();

export function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* quota dépassé : on ignore */
  }
}

export function resetDatabase(): void {
  localStorage.removeItem(KEY);
  Object.assign(db, seed());
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

/** Latence réseau simulée (300 à 600 ms) puis copie défensive du résultat. */
export function respond<T>(fn: () => T, min = 300, max = 600): Promise<T> {
  const ms = min + Math.random() * (max - min);
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(structuredClone(fn()));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Erreur inattendue."));
      }
    }, ms);
  });
}

/* ------------------------------------------------------------------ */
/* Requêtes de base, systématiquement filtrées par école                */
/* ------------------------------------------------------------------ */

export const classesOf = (schoolId: string): ClassRoom[] => db.classes.filter((c) => c.schoolId === schoolId);
export const studentsOf = (schoolId: string): Student[] => db.students.filter((s) => s.schoolId === schoolId);
export const teachersOf = (schoolId: string): Teacher[] => db.teachers.filter((t) => t.schoolId === schoolId);
export const parentsOf = (schoolId: string): Parent[] => db.parents.filter((p) => p.schoolId === schoolId);
export const subjectsOf = (schoolId: string): Subject[] => db.subjects.filter((s) => s.schoolId === schoolId);
export const classSubjectsOf = (schoolId: string): ClassSubject[] => db.classSubjects.filter((x) => x.schoolId === schoolId);
export const assignmentsOf = (schoolId: string): TeachingAssignment[] => db.assignments.filter((a) => a.schoolId === schoolId);
export const gradesOf = (schoolId: string): Grade[] => db.grades.filter((g) => g.schoolId === schoolId);
export const reportMetasOf = (schoolId: string): ReportMeta[] => db.reportMetas.filter((m) => m.schoolId === schoolId);
export const paymentsOf = (schoolId: string): Payment[] => db.payments.filter((p) => p.schoolId === schoolId);
export const conversationsOf = (schoolId: string): Conversation[] => db.conversations.filter((c) => c.schoolId === schoolId);
export const announcementsOf = (schoolId: string): Announcement[] => db.announcements.filter((a) => a.schoolId === schoolId);
export const absencesOf = (schoolId: string): AbsenceRecord[] => db.absences.filter((a) => a.schoolId === schoolId);
export const usersOf = (schoolId: string): User[] => db.users.filter((u) => u.schoolId === schoolId);
export const schoolOf = (schoolId: string): School | undefined => db.schools.find((s) => s.id === schoolId);
export const settingsOf = (schoolId: string): SchoolSettings =>
  db.settings.find((s) => s.schoolId === schoolId) ?? {
    schoolId,
    name: db.schools.find((s) => s.id === schoolId)?.name ?? "École",
    address: "",
    phone: "",
    email: "",
    schoolYear: "2026-2027",
    cycles: [],
    periodType: "semestre",
    currentPeriod: "S1",
    fees: {},
    annexFees: { cantine: 0, transport: 0, tenue: 0 },
    siblingDiscount: 0,
  };