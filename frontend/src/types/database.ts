/**
 * Contrat de types correspondant aux migrations supabase/migrations 2026…000001-2.
 *
 * À régénérer dès qu'une base locale est disponible :
 *   npx supabase gen types typescript --local > src/types/database.ts
 * En attendant, ce fichier est écrit à la main et doit rester en phase avec
 * les migrations (il reflète l'état de la phase 1).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Cycle = "elementaire" | "moyen" | "secondaire";
export type Role = "directeur" | "econome" | "secretaire" | "surveillant" | "instituteur" | "professeur" | "eleve" | "parent";
export type UserStatus = "ACTIF" | "EN_ATTENTE" | "DESACTIVE";
export type PeriodType = "semestre" | "trimestre";
export type PayMethod = "wave" | "orange_money" | "free_money" | "especes";
export type PaymentKind = "inscription" | "mensualite" | "tenue";
export type PaymentStatus = "paye" | "partiel" | "en_retard" | "a_venir";
export type AbsenceType = "absence" | "retard" | "discipline";
export type RequestStatus = "EN_ATTENTE" | "APPROUVEE" | "REFUSEE";
export type PlanId = "essentiel" | "pro" | "premium" | "illimite";

/* ------------------------------------------------------------------ */
/* Lignes                                                              */
/* ------------------------------------------------------------------ */

export interface LevelRow { id: string; label: string; cycle: Cycle; level_order: number; exam: string | null }
export interface PlanRow {
  id: PlanId; name: string; tagline: string; student_limit: number | null;
  monthly_price: number; yearly_price: number; features: string[]; highlight: boolean;
  created_at: string;
}
export interface SchoolRow {
  id: string; name: string; matricule: string | null; city: string; address: string;
  phone: string; email: string; logo_url: string | null; cycles: Cycle[];
  registration_open: boolean; auto_approve_students: boolean; created_at: string;
}
export interface SchoolSettingsRow {
  school_id: string; school_year: string; period_type: PeriodType; current_period: string;
  annex_fees: { cantine: number; transport: number; tenue: number };
  sibling_discount: number; block_student_bulletins: boolean; created_at: string;
}
export interface LevelFeesRow { school_id: string; level_id: string; inscription: number; mensualite: number; created_at: string }
export interface SubscriptionRow {
  id: string; school_id: string; plan_id: PlanId; starts_at: string | null; ends_at: string | null;
  student_limit: number | null; amount_paid: number; payment_ref: string;
  method: PayMethod | null; paid_at: string | null; created_at: string;
}
export interface SubscriptionEventRow {
  id: string; school_id: string; event_type: "purchase" | "renewal" | "plan_change" | "expiration_warning";
  plan_id: PlanId | null; amount_paid: number | null; payment_ref: string | null;
  method: PayMethod | null; starts_at: string | null; ends_at: string | null;
  payload: Json; created_at: string;
}
export interface CounterRow { school_id: string; counter: string; year: string; value: number; updated_at: string }
export interface TeacherRow {
  id: string; school_id: string; kind: "instituteur" | "professeur"; first_name: string; last_name: string;
  email: string; phone: string; specialties: string[]; created_at: string;
}
export interface ParentRow {
  id: string; school_id: string; first_name: string; last_name: string;
  phone: string; email: string; address: string; created_at: string;
}
export interface ClassRoomRow {
  id: string; school_id: string; name: string; level_id: string; cycle: Cycle; series: string | null;
  head_teacher_id: string | null; capacity: number; created_at: string;
}
export interface StudentRow {
  id: string; school_id: string; matricule: string; child_code: string; first_name: string;
  last_name: string; gender: "F" | "M"; birth_date: string | null; class_id: string;
  parent_id: string | null;
  options: { cantine: boolean; transport: boolean; tenue: boolean };
  enrolled_at: string; created_at: string;
}
export interface ProfileRow {
  id: string; school_id: string; role: Role; status: UserStatus; first_name: string;
  last_name: string; phone: string; email: string; must_change_password: boolean;
  teacher_id: string | null; parent_id: string | null; student_id: string | null; created_at: string;
}
export interface SubjectRow { id: string; school_id: string; name: string; cycles: Cycle[]; created_at: string }
export interface ClassSubjectRow { id: string; school_id: string; class_id: string; subject_id: string; coefficient: number; created_at: string }
export interface TeachingAssignmentRow { id: string; school_id: string; teacher_id: string; class_id: string; subject_id: string; created_at: string }
export interface GradeRow {
  id: string; school_id: string; student_id: string; class_id: string; subject_id: string;
  period: string; devoir1: number | null; devoir2: number | null; composition: number | null;
  created_at: string; updated_at: string;
}
export interface ReportMetaRow {
  id: string; school_id: string; student_id: string; period: string; conduct: string;
  absences: number; comment: string; created_at: string; updated_at: string;
}
export interface PaymentRow {
  id: string; school_id: string; student_id: string; kind: PaymentKind; label: string;
  due_date: string; amount: number; paid_amount: number; status: PaymentStatus;
  method: PayMethod | null; paid_at: string | null; reference: string | null; created_at: string;
}
export interface PaymentTransactionRow {
  id: string; school_id: string; tx_kind: "subscription" | "installment"; payment_id: string | null;
  provider: string; provider_ref: string; amount: number; method: PayMethod; phone: string;
  status: "pending" | "succeeded" | "failed"; payload: Json; created_at: string; updated_at: string;
}
export interface ConversationRow {
  id: string; school_id: string; teacher_id: string; parent_id: string; student_id: string;
  subject: string; created_at: string;
}
export interface MessageRow { id: string; school_id: string; conversation_id: string; sender_id: string; text: string; created_at: string }
export interface ConversationReadRow { conversation_id: string; actor_id: string; last_read_at: string }
export interface AnnouncementRow {
  id: string; school_id: string; title: string; body: string; author: string;
  audience_all: boolean; audience_roles: Role[]; created_at: string;
}
export interface AbsenceRow {
  id: string; school_id: string; student_id: string; absence_date: string;
  absence_type: AbsenceType; motif: string; justified: boolean; sanction: string | null; created_at: string;
}
export interface RegistrationRequestRow {
  id: string; school_id: string; user_id: string; role: "eleve" | "parent";
  first_name: string; last_name: string; email: string; phone: string;
  gender: "F" | "M" | null; birth_date: string | null; class_id: string | null; child_code: string | null;
  status: RequestStatus; decided_at: string | null; reason: string | null; created_at: string;
}
export interface ContactMessageRow {
  id: string; name: string; email: string; phone: string; school: string | null;
  subject: string; message: string; created_at: string;
}
export interface AuditLogRow {
  id: string; school_id: string | null; actor_id: string | null; actor_role: string | null;
  action: string; entity: string; entity_id: string | null; payload: Json; created_at: string;
}

/* ------------------------------------------------------------------ */
/* Définition de schéma pour supabase-js                               */
/* ------------------------------------------------------------------ */

type RowMap = {
  levels: LevelRow;
  plans: PlanRow;
  schools: SchoolRow;
  school_settings: SchoolSettingsRow;
  level_fees: LevelFeesRow;
  subscriptions: SubscriptionRow;
  subscription_events: SubscriptionEventRow;
  counters: CounterRow;
  teachers: TeacherRow;
  parents: ParentRow;
  class_rooms: ClassRoomRow;
  students: StudentRow;
  profiles: ProfileRow;
  subjects: SubjectRow;
  class_subjects: ClassSubjectRow;
  teaching_assignments: TeachingAssignmentRow;
  grades: GradeRow;
  report_metas: ReportMetaRow;
  payments: PaymentRow;
  payment_transactions: PaymentTransactionRow;
  conversations: ConversationRow;
  messages: MessageRow;
  conversation_reads: ConversationReadRow;
  announcements: AnnouncementRow;
  absences: AbsenceRow;
  registration_requests: RegistrationRequestRow;
  contact_messages: ContactMessageRow;
  audit_log: AuditLogRow;
};

type RowOf<K extends keyof RowMap> = RowMap[K];
/** Payload d'insertion partiel : les colonnes avec défaut serveur sont optionnelles. */
type InsertOf<K extends keyof RowMap> = Partial<RowOf<K>>;
/** Patch de mise à jour partiel. */
type UpdateOf<K extends keyof RowMap> = Partial<RowOf<K>>;

type TableDef<K extends keyof RowMap> = {
  Row: RowOf<K>;
  Insert: InsertOf<K>;
  Update: UpdateOf<K>;
};

/** Formats attendus par createClient<Database>() de supabase-js (version 2). */
export type Database = {
  public: {
    Tables: {
      [K in keyof RowMap]: TableDef<K>;
    };
    Views: Record<string, never>;
    Functions: {
      current_school_id: { Args: Record<string, never>; Returns: string };
      current_role: { Args: Record<string, never>; Returns: string };
      current_teacher_id: { Args: Record<string, never>; Returns: string };
      current_parent_id: { Args: Record<string, never>; Returns: string };
      current_student_id: { Args: Record<string, never>; Returns: string };
      is_active_user: { Args: Record<string, never>; Returns: boolean };
      password_changed: { Args: Record<string, never>; Returns: boolean };
      subscription_info: { Args: { p_school_id: string }; Returns: SubscriptionInfoResult };
      school_is_writable: { Args: { p_school_id: string }; Returns: boolean };
      school_is_readable: { Args: { p_school_id: string }; Returns: boolean };
      generate_school_code: { Args: { p_school_id: string; p_length: number; p_column: string }; Returns: string };
      next_student_matricule: { Args: { p_school_id: string; p_school_year: string }; Returns: string };
    };
    CompositeTypes: {
      subscription_info_result: SubscriptionInfoResult;
    };
    Enums: Record<string, never>;
  };
};

export interface SubscriptionInfoResult {
  status: "AUCUN" | "ACTIF" | "EXPIRE_BIENTOT" | "EXPIRE";
  days_left: number;
  read_only: boolean;
  blocked: boolean;
  student_limit: number | null;
  active_students: number;
  limit_reached: boolean;
  plan_id: PlanId | null;
  plan_name: string | null;
}
