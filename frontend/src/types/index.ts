export type Cycle = "elementaire" | "moyen" | "secondaire";
export type Role = "directeur" | "econome" | "surveillant" | "instituteur" | "professeur" | "eleve" | "parent";
/** Rôles que seul le directeur peut créer via un accès enseignant. */
export type StaffRole = Extract<Role, "professeur" | "instituteur" | "econome" | "surveillant">;
/** Cycle de vie d'un compte : en attente de validation par la direction, actif, ou désactivé. */
export type UserStatus = "ACTIF" | "EN_ATTENTE" | "DESACTIVE";
export type PeriodType = "semestre" | "trimestre";
export type PayMethod = "wave" | "orange_money" | "free_money" | "especes";
export type PaymentKind = "inscription" | "mensualite" | "tenue";
export type PaymentStatus = "paye" | "partiel" | "en_retard" | "a_venir";
export type StudentPayStatus = "a_jour" | "partiel" | "impaye";
/** Statuts d'abonnement d'une école. */
export type SubscriptionStatus = "AUCUN" | "ACTIF" | "EXPIRE_BIENTOT" | "EXPIRE";

/* ------------------------------------------------------------------ */
/* Écoles, forfaits, abonnements                                        */
/* ------------------------------------------------------------------ */

export interface School {
  id: string;
  name: string;
  /** Matricule d'école (5 caractères) — vide tant que l'abonnement n'a pas été payé. */
  matricule: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
  cycles: Cycle[];
  /** Interrupteur du directeur : ferme temporairement les inscriptions. */
  registrationOpen: boolean;
  /** Option des paramètres : approuve automatiquement les inscriptions d'élèves. */
  autoApproveStudents: boolean;
  createdAt: string;
}

export type PlanId = "essentiel" | "pro" | "premium" | "illimite";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Nombre d'élèves actifs maximum — null = illimité. */
  studentLimit: number | null;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  highlight?: boolean;
}

export interface Subscription {
  id: string;
  schoolId: string;
  plan: PlanId;
  status: SubscriptionStatus;
  startsAt: string;
  endsAt: string;
  studentLimit: number | null;
  amountPaid: number;
  paymentRef: string;
  method?: PayMethod;
  paidAt: string;
}

export type RegistrationRequestStatus = "EN_ATTENTE" | "APPROUVEE" | "REFUSEE";

/** Demande d'inscription d'un élève ou d'un parent, en attente de validation par la direction. */
export interface SchoolRegistrationRequest {
  id: string;
  schoolId: string;
  userId: string;
  role: "eleve" | "parent";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender?: "F" | "M";
  birthDate?: string;
  classId?: string;
  /** Code élève communiqué par l'école (demande de type parent). */
  childCode?: string;
  createdAt: string;
  status: RegistrationRequestStatus;
  decidedAt?: string;
  reason?: string;
}

/* ------------------------------------------------------------------ */
/* Données pédagogiques (toutes porteuses de schoolId)                   */
/* ------------------------------------------------------------------ */

export interface Level {
  id: string;
  label: string;
  cycle: Cycle;
  order: number;
  exam?: string;
}

export interface ClassRoom {
  schoolId: string;
  id: string;
  name: string;
  levelId: string;
  cycle: Cycle;
  series?: string;
  /** Instituteur titulaire (élémentaire) ou professeur principal (moyen / secondaire) */
  headTeacherId: string | null;
  capacity: number;
}

export interface Subject {
  schoolId: string;
  id: string;
  name: string;
  cycles: Cycle[];
}

export interface ClassSubject {
  schoolId: string;
  classId: string;
  subjectId: string;
  coefficient: number;
}

export interface Teacher {
  schoolId: string;
  id: string;
  firstName: string;
  lastName: string;
  kind: "instituteur" | "professeur";
  email: string;
  phone: string;
  specialties: string[];
}

export interface TeachingAssignment {
  schoolId: string;
  teacherId: string;
  classId: string;
  subjectId: string;
}

export interface Parent {
  schoolId: string;
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
}

export interface StudentOptions {
  cantine: boolean;
  transport: boolean;
  tenue: boolean;
}

export interface Student {
  schoolId: string;
  id: string;
  matricule: string;
  /** Code à 6 caractères donné par l'école aux familles (rattachement parent). */
  childCode: string;
  firstName: string;
  lastName: string;
  gender: "F" | "M";
  birthDate: string;
  classId: string;
  parentId: string;
  options: StudentOptions;
  enrolledAt: string;
}

export interface Grade {
  schoolId: string;
  studentId: string;
  classId: string;
  subjectId: string;
  period: string;
  devoir1: number | null;
  devoir2: number | null;
  composition: number | null;
}

export interface ReportMeta {
  schoolId: string;
  studentId: string;
  period: string;
  conduct: string;
  absences: number;
  comment: string;
}

export interface Payment {
  schoolId: string;
  id: string;
  studentId: string;
  kind: PaymentKind;
  label: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: PaymentStatus;
  method?: PayMethod;
  paidAt?: string;
  reference?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  at: string;
}

export interface Conversation {
  schoolId: string;
  id: string;
  teacherId: string;
  parentId: string;
  studentId: string;
  subject: string;
  messages: ChatMessage[];
  lastReadAt: Record<string, string>;
}

export interface Announcement {
  schoolId: string;
  id: string;
  title: string;
  body: string;
  at: string;
  author: string;
  audience: Role[] | "all";
}

export interface AbsenceRecord {
  schoolId: string;
  id: string;
  studentId: string;
  date: string;
  type: "absence" | "retard" | "discipline";
  motif: string;
  justified: boolean;
  sanction?: string;
}

/* ------------------------------------------------------------------ */
/* Agents administratifs Classora (interne, hors école)                 */
/* ------------------------------------------------------------------ */

export type AdminAgentRole = "superadmin" | "admin" | "agent_suivi";

export interface AdminAgent {
  id: string;
  matricule: string; // CLA-ADM-000001
  role: AdminAgentRole;
  status: "ACTIF" | "EN_ATTENTE" | "DESACTIVE";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  createdAt: string;
  updatedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Statistiques transversales (admin)                                   */
/* ------------------------------------------------------------------ */

export interface AdminOverviewStats {
  generatedAt: string;
  schools: {
    total: number;
    active: number;
    suspended: number;
  };
  people: {
    totalStudents: number;
    totalClasses: number;
    totalDirectors: number;
    totalTeachers: number;
    totalParents: number;
  };
  bySchool: Array<{
    schoolId: string;
    schoolName: string;
    matricule: string;
    studentCount: number;
    classCount: number;
    teacherCount: number;
    status: "AUCUN" | "ACTIF" | "EXPIRE";
  }>;
  recentActivity: Array<{
    action: string;
    entity: string;
    createdAt: string;
    schoolId: string | null;
    actorRole: string | null;
  }>;
}

/* ------------------------------------------------------------------ */
/* École vue admin (transversale)                                       */
/* ------------------------------------------------------------------ */

export interface AdminSchool {
  id: string;
  name: string;
  matricule: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
  cycles: string[];
  registrationOpen: boolean;
  autoApproveStudents: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Comptes                                                               */
/* ------------------------------------------------------------------ */

/**
 * Un utilisateur appartient à UNE école (schoolId). Aucun service ne doit lire
 * une ligne de donnée dont le schoolId diffère de celui de la session.
 * `passwordHash` n'est jamais renvoyé au client : voir services/authService.
 */
export interface User {
  id: string;
  schoolId: string;
  email: string;
  /** Empreinte simulée — le vrai hachage se fait côté serveur (voir SUPABASE_NOTES.md). */
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: Role;
  status: UserStatus;
  /** Mot de passe temporaire : changement obligatoire avant d'accéder à l'application. */
  mustChangePassword: boolean;
  createdAt: string;
  teacherId?: string;
  parentId?: string;
  studentId?: string;
}

export type SessionUser = Omit<User, "passwordHash">;

export interface LevelFees {
  inscription: number;
  mensualite: number;
}

export interface SchoolSettings {
  schoolId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  schoolYear: string;
  cycles: Cycle[];
  periodType: PeriodType;
  currentPeriod: string;
  fees: Record<string, LevelFees>;
  annexFees: { cantine: number; transport: number; tenue: number };
  siblingDiscount: number;
}

export interface Period {
  id: string;
  label: string;
}

export interface ReportLine {
  subjectId: string;
  subjectName: string;
  coefficient: number;
  devoir1: number | null;
  devoir2: number | null;
  devoirsAvg: number | null;
  composition: number | null;
  average: number | null;
  rank: number | null;
  teacherName: string;
  appreciation: string;
}

export interface ReportCardData {
  student: Student;
  classRoom: ClassRoom;
  period: Period;
  lines: ReportLine[];
  generalAverage: number | null;
  rank: number | null;
  classSize: number;
  classAverage: number | null;
  meta: ReportMeta;
  headTeacherName: string;
}

export interface Conflict {
  id: string;
  severity: "error" | "warning";
  classId?: string;
  subjectId?: string;
  teacherId?: string;
  message: string;
}