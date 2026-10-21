import type {
  AbsenceRecord,
  Announcement,
  ChatMessage,
  ClassRoom,
  ClassSubject,
  Conversation,
  Cycle,
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
import { supabase } from "@/lib/supabase";

/**
 * Cache de référence de l'école, hydraté depuis Supabase sous les politiques
 * RLS : chaque tableau est rempli avec ce que LE rôle de la session est
 * autorisé à lire (fonction hydrate). Les lectures de l'interface passent par
 * les helpers `xOf(schoolId)` exactement comme avant ; les écritures passent
 * par les RPCs du back-end puis re-hydratent l'entité concernée.
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

/** « Base de données » locale de la session (cache, jamais persistée ici). */
export const db: Database = {
  schools: [],
  subscriptions: [],
  registrationRequests: [],
  users: [],
  teachers: [],
  parents: [],
  students: [],
  classes: [],
  subjects: [],
  classSubjects: [],
  assignments: [],
  grades: [],
  reportMetas: [],
  payments: [],
  conversations: [],
  announcements: [],
  absences: [],
  settings: [],
};

function replace(tableName: keyof Database, rows: unknown[]): void {
  (db[tableName] as unknown[]).splice(0, (db[tableName] as unknown[]).length, ...rows);
}

const iso = (v: string | null): string => v ?? "";
const date = (v: string | null): string => v ?? "";

function mapSchool(r: any): School {
  return {
    id: r.id,
    name: r.name,
    matricule: r.matricule ?? "",
    city: r.city ?? "",
    address: r.address ?? "",
    phone: r.phone ?? "",
    email: r.email ?? "",
    logoUrl: r.logo_url ?? undefined,
    cycles: (r.cycles ?? []) as Cycle[],
    registrationOpen: r.registration_open ?? true,
    autoApproveStudents: r.auto_approve_students ?? false,
    createdAt: iso(r.created_at).slice(0, 10),
  };
}

function mapSettings(r: any): SchoolSettings {
  return {
    schoolId: r.school_id,
    name: r.name,
    address: r.address ?? "",
    phone: r.phone ?? "",
    email: r.email ?? "",
    schoolYear: r.school_year,
    cycles: (r.cycles ?? []) as Cycle[],
    periodType: r.period_type ?? "semestre",
    currentPeriod: r.current_period ?? "S1",
    fees: r.fees ?? {},
    annexFees: r.annex_fees ?? { cantine: 0, transport: 0, tenue: 0 },
    siblingDiscount: r.sibling_discount ?? 0,
  };
}

function mapSubscription(r: any): Subscription {
  return {
    id: r.id,
    schoolId: r.school_id,
    plan: r.plan_id,
    status: "ACTIF",
    startsAt: date(r.starts_at),
    endsAt: date(r.ends_at),
    studentLimit: r.student_limit ?? null,
    amountPaid: r.amount_paid ?? 0,
    paymentRef: r.payment_ref ?? "",
    method: r.method ?? undefined,
    paidAt: r.paid_at ? String(r.paid_at).slice(0, 16) : "",
  };
}

function mapTeacher(r: any): Teacher {
  return {
    schoolId: r.school_id,
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    kind: r.kind,
    email: r.email,
    phone: r.phone ?? "",
    specialties: r.specialties ?? [],
  };
}

function mapParent(r: any): Parent {
  return {
    schoolId: r.school_id,
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    phone: r.phone ?? "",
    email: r.email,
    address: r.address ?? "",
  };
}

function mapStudent(r: any): Student {
  return {
    schoolId: r.school_id,
    id: r.id,
    matricule: r.matricule,
    childCode: r.child_code,
    firstName: r.first_name,
    lastName: r.last_name,
    gender: r.gender,
    birthDate: r.birth_date ?? "",
    classId: r.class_id,
    parentId: r.parent_id ?? "",
    options: r.options ?? { cantine: false, transport: false, tenue: false },
    enrolledAt: r.enrolled_at ?? "",
  };
}

function mapClass(r: any): ClassRoom {
  return {
    schoolId: r.school_id,
    id: r.id,
    name: r.name,
    levelId: r.level_id,
    cycle: r.cycle,
    series: r.series ?? undefined,
    headTeacherId: r.head_teacher_id ?? null,
    capacity: r.capacity,
  };
}

function mapSubject(r: any): Subject {
  return {
    schoolId: r.school_id,
    id: r.id,
    name: r.name,
    cycles: (r.cycles ?? []) as Cycle[],
  };
}

function mapClassSubject(r: any): ClassSubject {
  return {
    schoolId: r.school_id,
    classId: r.class_id,
    subjectId: r.subject_id,
    coefficient: Number(r.coefficient ?? 1),
  };
}

function mapAssignment(r: any): TeachingAssignment {
  return {
    schoolId: r.school_id,
    teacherId: r.teacher_id,
    classId: r.class_id,
    subjectId: r.subject_id,
  };
}

function mapGrade(r: any): Grade {
  return {
    schoolId: r.school_id,
    studentId: r.student_id,
    classId: r.class_id,
    subjectId: r.subject_id,
    period: r.period,
    devoir1: r.devoir1 === null ? null : Number(r.devoir1),
    devoir2: r.devoir2 === null ? null : Number(r.devoir2),
    composition: r.composition === null ? null : Number(r.composition),
  };
}

function mapReportMeta(r: any): ReportMeta {
  return {
    schoolId: r.school_id,
    studentId: r.student_id,
    period: r.period,
    conduct: r.conduct ?? "Bonne",
    absences: r.absences ?? 0,
    comment: r.comment ?? "",
  };
}

function mapPayment(r: any): Payment {
  return {
    schoolId: r.school_id,
    id: r.id,
    studentId: r.student_id,
    kind: r.kind,
    label: r.label,
    dueDate: r.due_date,
    amount: r.amount,
    paidAmount: r.paid_amount ?? 0,
    status: r.status,
    method: r.method ?? undefined,
    paidAt: r.paid_at ?? undefined,
    reference: r.reference ?? undefined,
  };
}

function mapRequest(r: any): SchoolRegistrationRequest {
  return {
    id: r.id,
    schoolId: r.school_id,
    userId: r.user_id,
    role: r.role,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    phone: r.phone ?? "",
    gender: r.gender ?? undefined,
    birthDate: r.birth_date ?? undefined,
    classId: r.class_id ?? undefined,
    childCode: r.child_code ?? undefined,
    createdAt: iso(r.created_at).slice(0, 10),
    status: r.status,
    decidedAt: r.decided_at ?? undefined,
    reason: r.reason ?? undefined,
  };
}

function mapProfile(r: any): User {
  return {
    id: r.id,
    schoolId: r.school_id,
    email: r.email ?? "",
    passwordHash: "",
    firstName: r.first_name ?? "",
    lastName: r.last_name ?? "",
    phone: r.phone ?? "",
    role: r.role,
    status: r.status,
    mustChangePassword: r.must_change_password ?? false,
    teacherId: r.teacher_id ?? undefined,
    parentId: r.parent_id ?? undefined,
    studentId: r.student_id ?? undefined,
    createdAt: iso(r.created_at),
  };
}

function mapAbsence(r: any): AbsenceRecord {
  return {
    schoolId: r.school_id,
    id: r.id,
    studentId: r.student_id,
    date: r.absence_date,
    type: r.absence_type,
    motif: r.motif ?? "",
    justified: r.justified ?? false,
    ...(r.sanction ? { sanction: r.sanction } : {}),
  };
}

function mapAnnouncement(r: any): Announcement {
  return {
    schoolId: r.school_id,
    id: r.id,
    title: r.title,
    body: r.body,
    at: iso(r.created_at).slice(0, 16),
    author: r.author,
    audience: r.audience_all ? "all" : ((r.audience_roles ?? []) as Announcement["audience"]),
  };
}

async function hydrateConversations(): Promise<void> {
  const { data, error } = await supabase.rpc("list_conversations");
  if (error) {
    console.error("[db] hydratation conversations refusée :", error.message);
    return;
  }
  const rows = (data ?? []) as any[];
  const conversations: Conversation[] = rows.map((c) => {
    const messages: ChatMessage[] = ((c.messages ?? []) as any[]).map((m) => ({
      id: m.id,
      senderId: m.senderId,
      text: m.text,
      at: iso(m.at).slice(0, 16),
    }));
    const lastReadAt: Record<string, string> = {};
    Object.entries((c.lastReadAt ?? {}) as Record<string, string>).forEach(([actorId, at]) => {
      lastReadAt[actorId] = iso(at).slice(0, 16);
    });
    return {
      schoolId: c.schoolId,
      id: c.id,
      teacherId: c.teacherId,
      parentId: c.parentId,
      studentId: c.studentId,
      subject: c.subject ?? "",
      messages,
      lastReadAt,
    };
  });
  replace("conversations", conversations);
}

const HYDRATION_PAGE_SIZE = 500;
const HYDRATION_MAX_ROWS = 100_000;

async function fetchAllRows(table: string): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += HYDRATION_PAGE_SIZE) {
    const to = from + HYDRATION_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as any[];
    rows.push(...page);
    if (page.length < HYDRATION_PAGE_SIZE) return rows;
    if (rows.length >= HYDRATION_MAX_ROWS) {
      throw new Error(`Plus de ${HYDRATION_MAX_ROWS} lignes à hydrater pour ${table}.`);
    }
  }
}

async function assign(tableName: keyof Database): Promise<void> {
  const table = TABLES[tableName];
  if (!table) return;
  try {
    const data = await fetchAllRows(table);
    replace(tableName, data.map(MAPPERS[tableName]));
  } catch (e) {
    console.error(`[db] hydratation ${tableName} échouée :`, e);
  }
}

const MAPPERS: Record<keyof Database, (r: any) => any> = {
  schools: mapSchool,
  subscriptions: mapSubscription,
  registrationRequests: mapRequest,
  users: mapProfile,
  teachers: mapTeacher,
  parents: mapParent,
  students: mapStudent,
  classes: mapClass,
  subjects: mapSubject,
  classSubjects: mapClassSubject,
  assignments: mapAssignment,
  grades: mapGrade,
  reportMetas: mapReportMeta,
  payments: mapPayment,
  conversations: (r: any) => r,
  announcements: mapAnnouncement,
  absences: mapAbsence,
  settings: mapSettings,
};

const TABLES: Partial<Record<keyof Database, string>> = {
  schools: "schools",
  subscriptions: "subscriptions",
  registrationRequests: "registration_requests",
  users: "profiles",
  teachers: "teachers",
  parents: "parents",
  students: "students",
  classes: "class_rooms",
  subjects: "subjects",
  classSubjects: "class_subjects",
  assignments: "teaching_assignments",
  grades: "grades",
  reportMetas: "report_metas",
  payments: "payments",
  announcements: "announcements",
  absences: "absences",
  settings: "school_settings",
};

/** Recharge les paramètres d'école (réunion school_settings + école + frais). */
async function hydrateSettings(): Promise<void> {
  const [settingsRes, feesRes, schoolsRes] = await Promise.all([
    supabase.from("school_settings").select("*"),
    supabase.from("level_fees").select("*"),
    supabase.from("schools").select("*"),
  ]);
  if (settingsRes.error) {
    console.error("[db] hydratation settings refusée :", settingsRes.error.message);
    return;
  }
  const schools = (schoolsRes.data ?? []) as any[];
  const fees = (feesRes.data ?? []) as any[];
  replace(
    "settings",
    ((settingsRes.data ?? []) as any[]).map((r) => {
      const sc = schools.find((x) => x.id === r.school_id) ?? {};
      const levelFees: Record<string, { inscription: number; mensualite: number }> = {};
      fees.filter((f) => f.school_id === r.school_id).forEach((f) => {
        levelFees[f.level_id] = { inscription: f.inscription, mensualite: f.mensualite };
      });
      return mapSettings({
        ...r,
        name: sc.name ?? "École",
        address: sc.address ?? "",
        phone: sc.phone ?? "",
        email: sc.email ?? "",
        cycles: sc.cycles ?? [],
        fees: levelFees,
      });
    }),
  );
}

export function hydrate(entity: keyof Database): Promise<void> {
  if (entity === "conversations") return hydrateConversations().catch(() => undefined);
  if (entity === "settings") return hydrateSettings().catch(() => undefined);
  return assign(entity);
}

/** Hydrate tout le cache avec ce que le rôle courant peut lire. */
export async function hydrateAll(): Promise<void> {
  await Promise.all([
    hydrate("schools"),
    hydrate("subscriptions"),
    hydrate("registrationRequests"),
    hydrate("users"),
    hydrate("teachers"),
    hydrate("parents"),
    hydrate("students"),
    hydrate("classes"),
    hydrate("subjects"),
    hydrate("classSubjects"),
    hydrate("assignments"),
    hydrate("grades"),
    hydrate("reportMetas"),
    hydrate("payments"),
    hydrate("conversations"),
    hydrate("announcements"),
    hydrate("absences"),
    hydrate("settings"),
  ]);
}

export async function clearCache(): Promise<void> {
  (Object.keys(db) as (keyof Database)[]).forEach((k) => {
    (db[k] as unknown[]).splice(0, (db[k] as unknown[]).length);
  });
}

/** Conservé pour la compatibilité des services : l'écriture est côté serveur. */
export function persist(): void {
  window.dispatchEvent(new Event("ec:data"));
}

export function resetDatabase(): void {
  clearCache().then(() => hydrateAll());
}

export function uid(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  return `${prefix}-${suffix}`;
}

/** Copie défensive du résultat (la persistance est désormais côté serveur). */
export function respond<T>(fn: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      resolve(structuredClone(fn()));
    } catch (e) {
      reject(e instanceof Error ? e : new Error("Erreur inattendue."));
    }
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
