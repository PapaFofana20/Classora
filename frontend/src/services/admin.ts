/**
 * Services de l'administration Classora.
 * Toutes les requêtes passent par l'API backend (VITE_API_URL) avec le JWT
 * de session. La clé service_role n'est JAMAIS exposée au navigateur.
 * callFunction() ajoute automatiquement le header Authorization: Bearer <JWT>.
 */
import { callFunction } from "@/lib/functions";
import type { AdminAgent, AdminAgentRole, AdminOverviewStats, AdminSchool } from "@/types";

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

/* ------------------------------------------------------------------ */
/* Statistiques transversales                                         */
/* ------------------------------------------------------------------ */

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  return callFunction<AdminOverviewStats>("admin/stats", undefined, "GET");
}