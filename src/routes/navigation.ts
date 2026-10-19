import type { Role } from "@/types";

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  section: string;
  /** Visible uniquement pour un enseignant principal / titulaire. */
  requiresHead?: boolean;
  /** Nombre affiché à droite du lien (demandes en attente). */
  badge?: number;
  /** Masqué lorsque l'école n'a pas d'abonnement actif (directeur). */
  requiresSubscription?: boolean;
  /** Réservé au directeur. */
  directorOnly?: boolean;
}

const dashboard = (label: string, icon = "dashboard"): NavItem => ({ to: "/app", label, icon, section: "Menu" });
const messages: NavItem = { to: "/app/messages", label: "Messages", icon: "forum", section: "Outils" };
const profile: NavItem = { to: "/app/parametres", label: "Mon profil", icon: "account_circle", section: "Outils" };
const subscription: NavItem = { to: "/app/abonnement", label: "Abonnement", icon: "workspace_premium", section: "École", directorOnly: true };

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  directeur: [
    dashboard("Tableau de bord"),
    { to: "/app/eleves", label: "Élèves", icon: "groups", section: "Menu", requiresSubscription: true },
    { to: "/app/eleves/demandes", label: "Demandes d'inscription", icon: "how_to_reg", section: "Menu", requiresSubscription: true },
    { to: "/app/inscription-eleve", label: "Inscription élève", icon: "person_add", section: "Menu", requiresSubscription: true },
    { to: "/app/classes", label: "Classes", icon: "meeting_room", section: "École", requiresSubscription: true },
    { to: "/app/enseignants", label: "Enseignants", icon: "badge", section: "École", requiresSubscription: true },
    { to: "/app/affectations", label: "Affectations", icon: "grid_view", section: "École", requiresSubscription: true },
    subscription,
    { to: "/app/notes", label: "Notes", icon: "edit_note", section: "Scolarité", requiresSubscription: true },
    { to: "/app/bulletins", label: "Bulletins", icon: "description", section: "Scolarité", requiresSubscription: true },
    { to: "/app/paiements", label: "Paiements", icon: "payments", section: "Finances", requiresSubscription: true },
    messages,
    { to: "/app/parametres", label: "Paramètres", icon: "settings", section: "Outils" },
  ],
  econome: [
    dashboard("Tableau de bord"),
    { to: "/app/eleves", label: "Élèves", icon: "groups", section: "Menu" },
    { to: "/app/paiements", label: "Paiements", icon: "payments", section: "Finances" },
    messages,
    profile,
  ],
  surveillant: [
    dashboard("Vie scolaire", "shield_person"),
    { to: "/app/eleves", label: "Élèves", icon: "groups", section: "Menu" },
    messages,
    profile,
  ],
  instituteur: [
    dashboard("Ma classe", "child_care"),
    { to: "/app/eleves", label: "Mes élèves", icon: "groups", section: "Menu" },
    { to: "/app/notes", label: "Notes", icon: "edit_note", section: "Scolarité" },
    { to: "/app/bulletins", label: "Bulletins", icon: "description", section: "Scolarité" },
    messages,
    profile,
  ],
  professeur: [
    dashboard("Mes classes", "co_present"),
    { to: "/app/notes", label: "Notes", icon: "edit_note", section: "Scolarité" },
    { to: "/app/eleves", label: "Mes élèves", icon: "groups", section: "Scolarité" },
    { to: "/app/bulletins", label: "Bulletins", icon: "description", section: "Scolarité", requiresHead: true },
    messages,
    profile,
  ],
  eleve: [
    dashboard("Ma scolarité", "backpack"),
    { to: "/app/notes", label: "Mes notes", icon: "edit_note", section: "Scolarité" },
    { to: "/app/bulletins", label: "Bulletins", icon: "description", section: "Scolarité" },
    { to: "/app/paiements", label: "Mes paiements", icon: "payments", section: "Finances" },
    messages,
    profile,
  ],
  parent: [
    dashboard("Suivi de mes enfants", "family_restroom"),
    { to: "/app/notes", label: "Notes", icon: "edit_note", section: "Scolarité" },
    { to: "/app/bulletins", label: "Bulletins", icon: "description", section: "Scolarité" },
    { to: "/app/paiements", label: "Paiements", icon: "payments", section: "Finances" },
    messages,
    profile,
  ],
};

const ALL: Role[] = ["directeur", "econome", "surveillant", "instituteur", "professeur", "eleve", "parent"];

/** Rôles autorisés par route (utilisé par RoleRoute). */
export const ROUTE_ROLES = {
  eleves: ["directeur", "econome", "surveillant", "instituteur", "professeur", "parent"] as Role[],
  eleve: ["directeur", "econome", "surveillant", "instituteur", "professeur", "eleve", "parent"] as Role[],
  inscription: ["directeur"] as Role[],
  classes: ["directeur"] as Role[],
  enseignants: ["directeur"] as Role[],
  demandes: ["directeur"] as Role[],
  abonnement: ["directeur"] as Role[],
  affectations: ["directeur"] as Role[],
  notes: ["directeur", "instituteur", "professeur", "eleve", "parent"] as Role[],
  bulletins: ["directeur", "instituteur", "professeur", "eleve", "parent"] as Role[],
  paiements: ["directeur", "econome", "eleve", "parent"] as Role[],
  messages: ALL,
  parametres: ALL,
};

export interface NavOptions {
  isHead?: boolean;
  /** École sans abonnement : le directeur ne voit que l'abonnement et son profil. */
  locked?: boolean;
  badges?: Record<string, number>;
}

/** Routes accessibles même sans abonnement actif (director sans abonnement, école expirée). */
export const ALWAYS_ALLOWED = ["/app/abonnement", "/app/parametres", "/app/mot-de-passe-temporaire"];

export function navFor(role: Role, options: NavOptions = {}): NavItem[] {
  const { isHead = false, locked = false, badges = {} } = options;
  return NAV_BY_ROLE[role]
    .filter((i) => !i.requiresHead || isHead)
    .filter((i) => (locked && i.requiresSubscription ? false : true))
    .map((i) => {
      const badge = badges[i.to];
      return badge ? { ...i, badge } : i;
    });
}

export const isAlwaysAllowed = (pathname: string): boolean => ALWAYS_ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`));