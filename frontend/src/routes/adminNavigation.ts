import type { AdminAgentRole } from "@/types";

export interface AdminNavItem {
  to: string;
  label: string;
  icon: string;
  section: string;
  /** Réservé au superadministrateur. */
  superAdminOnly?: boolean;
  /** Réservé aux admins et superadmins (pas agent_suivi). */
  adminOrSuper?: boolean;
}

const ADMIN_NAV: AdminNavItem[] = [
  { to: "/admin", label: "Tableau de bord", icon: "dashboard", section: "Pilotage" },
  { to: "/admin/ecoles", label: "Établissements", icon: "school", section: "Établissements" },
  { to: "/admin/agents", label: "Agents", icon: "badge", section: "Équipe", superAdminOnly: true },
];

export function adminNavFor(role: AdminAgentRole): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => {
    if (item.superAdminOnly && role !== "superadmin") return false;
    if (item.adminOrSuper && role === "agent_suivi") return false;
    return true;
  });
}

export const ADMIN_ROUTE_ROLES = {
  dashboard: ["superadmin", "admin", "agent_suivi"] as AdminAgentRole[],
  ecoles: ["superadmin", "admin", "agent_suivi"] as AdminAgentRole[],
  agents: ["superadmin"] as AdminAgentRole[],
};