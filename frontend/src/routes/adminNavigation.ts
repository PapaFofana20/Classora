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
  { to: "/admin/ecoles", label: "Tous les établissements", icon: "school", section: "Établissements" },
  { to: "/admin/ecoles?status=ACTIF", label: "Écoles actives", icon: "check_circle", section: "Établissements" },
  { to: "/admin/ecoles?status=SUSPENDUE", label: "Écoles suspendues", icon: "block", section: "Établissements" },
  { to: "/admin/agents", label: "Agents administratifs", icon: "badge", section: "Utilisateurs et accès", superAdminOnly: true },
  { to: "/admin/abonnements", label: "Vue d'ensemble", icon: "workspace_premium", section: "Abonnements" },
  { to: "/admin/abonnements/offres", label: "Offres et formules", icon: "tune", section: "Abonnements" },
  { to: "/admin/finances", label: "Vue financière", icon: "account_balance_wallet", section: "Finances" },
  { to: "/admin/finances/transactions", label: "Transactions et paiements", icon: "receipt_long", section: "Finances" },
  { to: "/admin/finances/factures", label: "Facturation", icon: "description", section: "Finances" },
  { to: "/admin/analyses", label: "Croissance des établissements", icon: "trending_up", section: "Analyses et statistiques" },
  { to: "/admin/supervision/audit", label: "Journal d'audit", icon: "history", section: "Supervision" },
  { to: "/admin/supervision/securite", label: "Sécurité", icon: "security", section: "Supervision" },
  { to: "/admin/parametres", label: "Paramètres généraux", icon: "settings", section: "Configuration" },
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