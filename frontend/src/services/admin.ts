/**
 * Services de l'administration Classora.
 * Toutes les requêtes passent par l'API backend (VITE_API_URL) avec le JWT
 * de session. La clé service_role n'est JAMAIS exposée au navigateur.
 * callFunction() ajoute automatiquement le header Authorization: Bearer <JWT>.
 */
import { callFunction } from "@/lib/functions";
import type {
  AdminAgent,
  AdminAgentRole,
  AdminAnalyticsData,
  AdminAuditData,
  AdminFinancesData,
  AdminOverviewStats,
  AdminSchool,
  AdminSecurityData,
  AdminSettingsData,
  AdminSubscriptionsData,
  PlatformSettings,
} from "@/types";

export type { AdminAgent, AdminAgentRole, AdminSchool };

/* ------------------------------------------------------------------ */
/* Authentification admin                                             */
/* ------------------------------------------------------------------ */

/** Vérifie que la session courante correspond à un agent admin ACTIF. */
export async function verifyAdminSession(): Promise<{
  agent: AdminAgent;
  status: "ACTIF";
}> {
  return callFunction<{ agent: AdminAgent; status: "ACTIF" }>("admin/auth", {}, "POST");
}

/**
 * Résout une matricule (ou un e-mail) administratif en e-mail de connexion,
 * après vérification du mot de passe côté serveur. Le client enchaîne ensuite
 * avec signInWithPassword(email, password) : les jetons restent gérés par
 * Supabase côté navigateur.
 */
export async function adminResolveLogin(input: {
  identifier: string;
  password: string;
}): Promise<{ email: string }> {
  return callFunction<{ email: string }>("admin/login", input, "POST");
}

/* ------------------------------------------------------------------ */
/* Agents                                                             */
/* ------------------------------------------------------------------ */

/** Liste tous les agents administratifs (superadmin, admin, agent_suivi). */
export async function listAdminAgents(): Promise<{ agents: AdminAgent[] }> {
  return callFunction<{ agents: AdminAgent[] }>("admin/agents", undefined, "GET");
}

/** Crée un nouvel agent administratif (superadmin uniquement). */
export interface CreateAdminAgentInput {
  role: AdminAgentRole;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  /** Mot de passe fixe choisi par le superadministrateur (aucun temporaire). */
  password: string;
}

export async function createAdminAgent(input: CreateAdminAgentInput): Promise<{
  userId: string;
  matricule: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AdminAgentRole;
}> {
  return callFunction("admin/agents", {
    role: input.role,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    password: input.password,
  }, "POST");
}

/** Met à jour un agent (rôle, statut, infos). */
export interface UpdateAdminAgentInput {
  agentId: string;
  role?: AdminAgentRole;
  status?: "ACTIF" | "EN_ATTENTE" | "DESACTIVE";
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export async function updateAdminAgent(input: UpdateAdminAgentInput): Promise<{ message: string }> {
  return callFunction("admin/agents", {
    agentId: input.agentId,
    ...(input.role !== undefined ? { role: input.role } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
    ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
  }, "PATCH");
}

/* ------------------------------------------------------------------ */
/* Établissements (transversal)                                       */
/* ------------------------------------------------------------------ */

/** Liste des écoles avec recherche, filtres, tri, pagination. */
export interface ListSchoolsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "ACTIF" | "SUSPENDUE" | null;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface ListSchoolsResult {
  schools: AdminSchool[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listAdminSchools(params: ListSchoolsParams = {}): Promise<ListSchoolsResult> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortDir) query.set("sortDir", params.sortDir);

  return callFunction<ListSchoolsResult>(`admin/schools?${query.toString()}`, undefined, "GET");
}

/* ------------------------------------------------------------------ */
/* Fiche détaillée d'un établissement                                 */
/* ------------------------------------------------------------------ */

export interface SchoolDirector {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  memberSince: string;
}

export interface SchoolClassRow {
  id: string;
  name: string;
  level: string;
  cycle: string;
  capacity: number;
  studentCount: number;
}

export interface SchoolTeacherRow {
  id: string;
  kind: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialties: string[];
}

export interface SchoolSubscription {
  plan: { id: string; name: string; tagline: string; studentLimit: number | null; monthlyPrice: number; yearlyPrice: number } | null;
  startsAt: string | null;
  endsAt: string | null;
  studentLimit: number | null;
  amountPaid: number;
  method: string | null;
  paidAt: string | null;
  status: "ACTIF" | "EXPIRE" | "AUCUN";
}

export interface AdminSchoolDetail {
  school: AdminSchool;
  director: SchoolDirector | null;
  stats: {
    students: number;
    girls: number;
    boys: number;
    classes: number;
    teachers: number;
    parents: number;
  };
  classes: SchoolClassRow[];
  teachers: SchoolTeacherRow[];
  teachersTotal: number;
  subscription: SchoolSubscription | null;
}

/** Fiche complète d'un établissement (direction, effectifs, classes, enseignants, abonnement). */
export async function getAdminSchoolDetail(schoolId: string): Promise<AdminSchoolDetail> {
  return callFunction<AdminSchoolDetail>(`admin/schools?id=${encodeURIComponent(schoolId)}`, undefined, "GET");
}

/** Met à jour les informations administratives d'une école. */
export interface UpdateSchoolInput {
  schoolId: string;
  name?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  cycles?: string[];
  registrationOpen?: boolean;
  autoApproveStudents?: boolean;
}

export async function updateAdminSchool(input: UpdateSchoolInput): Promise<{
  id: string;
  name: string;
  matricule: string;
}> {
  return callFunction("admin/schools", {
    schoolId: input.schoolId,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.cycles !== undefined ? { cycles: input.cycles } : {}),
    ...(input.registrationOpen !== undefined ? { registrationOpen: input.registrationOpen } : {}),
    ...(input.autoApproveStudents !== undefined ? { autoApproveStudents: input.autoApproveStudents } : {}),
  }, "PATCH");
}

/** Active ou suspend une école (superadmin uniquement). */
export interface SetSchoolStatusInput {
  schoolId: string;
  status: "ACTIF" | "SUSPENDUE";
}

export async function setAdminSchoolStatus(input: SetSchoolStatusInput): Promise<{ message: string }> {
  return callFunction("admin/schools", {
    action: "setStatus",
    schoolId: input.schoolId,
    status: input.status,
  }, "POST");
}

/**
 * Supprime DÉFINITIVEMENT un établissement (superadmin uniquement) : toutes
 * ses données partent en cascade et ses comptes Auth sont supprimés. La
 * matricule de l'établissement (ou son nom si la matricule n'existe pas
 * encore) doit être saisie pour confirmation côté interface.
 */
export interface DeleteSchoolInput {
  schoolId: string;
  /** Matricule de l'établissement, ou son nom si la matricule est vide. */
  confirmation: string;
}

export async function deleteAdminSchool(input: DeleteSchoolInput): Promise<{
  message: string;
  authUsersRemoved: number;
}> {
  return callFunction("admin/schools", {
    schoolId: input.schoolId,
    confirmation: input.confirmation,
  }, "DELETE");
}

/* ------------------------------------------------------------------ */
/* Statistiques transversales                                         */
/* ------------------------------------------------------------------ */

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  return callFunction<AdminOverviewStats>("admin/stats", undefined, "GET");
}

/* ------------------------------------------------------------------ */
/* Abonnements                                                        */
/* ------------------------------------------------------------------ */

export interface ListSubscriptionsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "all" | "ACTIF" | "EXPIRE" | "AUCUN" | "BIENTOT" | "SUSPENDUE";
  plan?: string;
}

export async function listAdminSubscriptions(params: ListSubscriptionsParams = {}): Promise<AdminSubscriptionsData> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.search) query.set("search", params.search);
  if (params.status && params.status !== "all") query.set("status", params.status);
  if (params.plan) query.set("plan", params.plan);
  return callFunction<AdminSubscriptionsData>(`admin/subscriptions?${query.toString()}`, undefined, "GET");
}

export interface ActivateSubscriptionInput {
  schoolId: string;
  planId: string;
  cycle: "monthly" | "yearly";
  method?: "wave" | "orange_money" | "free_money" | "especes";
  reference?: string;
  amount?: number;
}

export async function activateSubscription(input: ActivateSubscriptionInput): Promise<{
  message: string;
  activation: {
    school_id: string;
    matricule: string;
    plan_id: string;
    plan_name: string;
    cycle: string;
    amount_paid: number;
    payment_ref: string;
    method: string;
    starts_at: string;
    ends_at: string;
    new_subscription: boolean;
  };
}> {
  return callFunction("admin/subscriptions", { action: "activate", ...input }, "POST");
}

export async function cancelSubscriptionRequest(input: { requestId: string; reason?: string }): Promise<{ message: string }> {
  return callFunction("admin/subscriptions", { action: "cancelRequest", ...input }, "POST");
}

/* ------------------------------------------------------------------ */
/* Finances                                                           */
/* ------------------------------------------------------------------ */

export async function getAdminFinances(): Promise<AdminFinancesData> {
  return callFunction<AdminFinancesData>("admin/finances", undefined, "GET");
}

/* ------------------------------------------------------------------ */
/* Analyses                                                           */
/* ------------------------------------------------------------------ */

export async function getAdminAnalytics(): Promise<AdminAnalyticsData> {
  return callFunction<AdminAnalyticsData>("admin/analytics", undefined, "GET");
}

/* ------------------------------------------------------------------ */
/* Journal d'audit                                                    */
/* ------------------------------------------------------------------ */

export interface ListAuditParams {
  page?: number;
  pageSize?: number;
  search?: string;
  action?: string;
  days?: 7 | 30 | 90;
}

export async function listAdminAudit(params: ListAuditParams = {}): Promise<AdminAuditData> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.search) query.set("search", params.search);
  if (params.action) query.set("action", params.action);
  if (params.days) query.set("days", String(params.days));
  return callFunction<AdminAuditData>(`admin/audit?${query.toString()}`, undefined, "GET");
}

export async function purgeAdminAudit(olderThanDays: number): Promise<{ message: string; deleted: number; cutoff: string }> {
  return callFunction("admin/audit", { olderThanDays }, "DELETE");
}

/* ------------------------------------------------------------------ */
/* Sécurité                                                           */
/* ------------------------------------------------------------------ */

export async function getAdminSecurity(): Promise<AdminSecurityData> {
  return callFunction<AdminSecurityData>("admin/security", undefined, "GET");
}

/* ------------------------------------------------------------------ */
/* Paramètres de la plateforme                                        */
/* ------------------------------------------------------------------ */

export async function getAdminSettings(): Promise<AdminSettingsData> {
  return callFunction<AdminSettingsData>("admin/settings", undefined, "GET");
}

export async function updateAdminSettings(patch: Partial<PlatformSettings>): Promise<{
  settings: PlatformSettings;
  updatedAt: string | null;
  updatedByName: string | null;
  message: string;
}> {
  return callFunction("admin/settings", patch, "PATCH");
}