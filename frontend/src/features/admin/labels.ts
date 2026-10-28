/** Libellés partagés par les écrans d'administration. */

export const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadministrateur",
  admin: "Administrateur",
  agent_suivi: "Agent de suivi",
  directeur: "Directeur",
  professeur: "Professeur",
  instituteur: "Instituteur",
  parent: "Parent",
  eleve: "Élève",
  secretaire: "Secrétaire",
  econome: "Économe",
  surveillant: "Surveillant",
  service_role: "Service",
  scolaire: "Compte scolaire",
};

export const METHOD_LABELS: Record<string, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  free_money: "Free Money",
  especes: "Espèces",
  non_precise: "Non précisé",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  purchase: "Souscription",
  renewal: "Renouvellement",
  plan_change: "Changement de formule",
  expiration_warning: "Alerte d'expiration",
};

/** Actions journalisées (audit_log) → libellé lisible. */
export const ACTION_LABELS: Record<string, string> = {
  admin_login: "Connexion administrateur",
  admin_login_failed: "Échec de connexion admin",
  admin_login_blocked: "Connexion admin bloquée",
  admin_login_blocked_school_account: "Compte scolaire refusé (admin)",
  admin_login_matricule: "Connexion par matricule",
  admin_agent_created: "Agent créé",
  admin_agent_updated: "Agent modifié",
  admin_school_updated: "Établissement modifié",
  admin_school_status_changed: "Statut d'établissement modifié",
  admin_school_deleted: "Établissement supprimé",
  subscription_activated_manually: "Abonnement activé manuellement",
  subscription_request_cancelled: "Demande d'abonnement annulée",
  subscription_requested: "Demande d'abonnement déposée",
  subscription_purchased: "Abonnement souscrit",
  subscription_renewed: "Abonnement renouvelé",
  platform_settings_updated: "Paramètres de la plateforme modifiés",
  audit_log_purged: "Journal d'audit purgé",
  login: "Connexion",
  login_blocked_admin_agent: "Accès admin refusé (compte scolaire)",
  login_blocked_desactive: "Connexion bloquée (compte désactivé)",
  login_blocked_en_attente: "Connexion bloquée (en attente)",
  login_blocked_unknown_status: "Connexion bloquée (statut inconnu)",
  staff_account_created: "Compte personnel créé",
  staff_password_reset: "Mot de passe réinitialisé",
  staff_deactivated: "Compte personnel désactivé",
  staff_reactivated: "Compte personnel réactivé",
  staff_updated: "Compte personnel modifié",
};

export function actionLabel(action: string | null | undefined): string {
  if (!action) return "—";
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

export function methodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  return METHOD_LABELS[method] ?? method.replace(/_/g, " ");
}

export function eventLabel(type: string | null | undefined): string {
  if (!type) return "—";
  return EVENT_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

/** Reproduit localement le libellé mensuel « janv. » fourni par le serveur. */
export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(Date.UTC(year, month - 1, 1))
    .toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" })
    .replace(/\.$/, "");
}
