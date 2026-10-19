import type { Role, User } from "@/types";
import { hashPassword } from "@/utils/passwordHash";
import { SCHOOL_IDS } from "./schools";
import { childCodesOf, students } from "./students";

/** Mot de passe commun aux comptes de démonstration (mot de passe personnel à la première connexion). */
export const DEMO_PASSWORD = "demo1234";
const HASH = hashPassword(DEMO_PASSWORD);
const CREATED = "2026-08-12T09:00";

const caParent = students.find((s) => s.id === "s-ca-002")?.parentId ?? "";
const caStudent = students.find((s) => s.id === "s-ca-002");

export const users: User[] = [
  /* ---- Collège Sainte Marie (école de démonstration principale) ---- */
  { id: "u-dir", schoolId: SCHOOL_IDS.sainteMarie, email: "directeur@ecoleconnect.sn", passwordHash: HASH, firstName: "Aïssatou", lastName: "Diallo", phone: "77 300 11 22", role: "directeur", status: "ACTIF", mustChangePassword: false, createdAt: CREATED },
  { id: "u-eco", schoolId: SCHOOL_IDS.sainteMarie, email: "econome@ecoleconnect.sn", passwordHash: HASH, firstName: "Mame Diarra", lastName: "Gaye", phone: "78 410 22 33", role: "econome", status: "ACTIF", mustChangePassword: false, createdAt: CREATED },
  { id: "u-sur", schoolId: SCHOOL_IDS.sainteMarie, email: "surveillant@ecoleconnect.sn", passwordHash: HASH, firstName: "Modou", lastName: "Lô", phone: "76 220 10 45", role: "surveillant", status: "ACTIF", mustChangePassword: false, createdAt: CREATED },
  { id: "u-inst", schoolId: SCHOOL_IDS.sainteMarie, email: "instituteur@ecoleconnect.sn", passwordHash: HASH, firstName: "Moussa", lastName: "Sarr", phone: "77 560 71 02", role: "instituteur", status: "ACTIF", mustChangePassword: false, createdAt: CREATED, teacherId: "ti-cm2a" },
  { id: "u-math", schoolId: SCHOOL_IDS.sainteMarie, email: "prof.maths@ecoleconnect.sn", passwordHash: HASH, firstName: "Ibrahima", lastName: "Diop", phone: "77 810 45 66", role: "professeur", status: "ACTIF", mustChangePassword: false, createdAt: CREATED, teacherId: "t-math1" },
  { id: "u-fr", schoolId: SCHOOL_IDS.sainteMarie, email: "prof.francais@ecoleconnect.sn", passwordHash: HASH, firstName: "Awa", lastName: "Fall", phone: "77 905 11 28", role: "professeur", status: "ACTIF", mustChangePassword: false, createdAt: CREATED, teacherId: "t-fr1" },
  { id: "u-parent", schoolId: SCHOOL_IDS.sainteMarie, email: "parent@ecoleconnect.sn", passwordHash: HASH, firstName: "Fatou", lastName: "Ndiaye", phone: "77 412 56 90", role: "parent", status: "ACTIF", mustChangePassword: false, createdAt: CREATED, parentId: "p-demo" },
  { id: "u-eleve", schoolId: SCHOOL_IDS.sainteMarie, email: "eleve@ecoleconnect.sn", passwordHash: HASH, firstName: "Aïda", lastName: "Ndiaye", phone: "77 412 56 90", role: "eleve", status: "ACTIF", mustChangePassword: false, createdAt: CREATED, studentId: "s-aida" },

  /* ---- Groupe Scolaire Cheikh Anta (Thiès) : abonnement bientôt expiré ---- */
  { id: "u-ca-dir", schoolId: SCHOOL_IDS.cheikhAnta, email: "direction@cheikhanta-ecole.sn", passwordHash: HASH, firstName: "Ousmane", lastName: "Ndiaye", phone: "77 240 18 09", role: "directeur", status: "ACTIF", mustChangePassword: false, createdAt: "2026-09-02T08:30" },
  { id: "u-ca-math", schoolId: SCHOOL_IDS.cheikhAnta, email: "prof.maths@cheikhanta-ecole.sn", passwordHash: HASH, firstName: "Cheikh", lastName: "Mbaye", phone: "78 300 44 21", role: "professeur", status: "ACTIF", mustChangePassword: false, createdAt: "2026-09-03T10:15", teacherId: "t-ca-2" },
  { id: "u-ca-parent", schoolId: SCHOOL_IDS.cheikhAnta, email: "parent@cheikhanta-ecole.sn", passwordHash: HASH, firstName: "Sokhna", lastName: "Faye", phone: "76 510 33 12", role: "parent", status: "ACTIF", mustChangePassword: false, createdAt: "2026-09-05T16:40", parentId: caParent },
  { id: "u-ca-eleve", schoolId: SCHOOL_IDS.cheikhAnta, email: "eleve@cheikhanta-ecole.sn", passwordHash: HASH, firstName: caStudent?.firstName ?? "Élève", lastName: caStudent?.lastName ?? "Cheikh Anta", phone: "76 510 33 12", role: "eleve", status: "ACTIF", mustChangePassword: false, createdAt: "2026-09-05T16:41", studentId: caStudent?.id },

  /* ---- Institut Horizon (Mbour) : abonnement expiré, école en lecture seule ---- */
  { id: "u-ho-dir", schoolId: SCHOOL_IDS.horizon, email: "contact@institut-horizon.sn", passwordHash: HASH, firstName: "Abdoulaye", lastName: "Sène", phone: "77 640 90 33", role: "directeur", status: "ACTIF", mustChangePassword: false, createdAt: "2025-12-09T09:10" },

  /* ---- Complexe Scolaire Teranga (Saint-Louis) : accès bloqué (> 7 j) ---- */
  { id: "u-te-dir", schoolId: SCHOOL_IDS.teranga, email: "direction@teranga-ecole.sn", passwordHash: HASH, firstName: "Mamadou", lastName: "Diop", phone: "78 220 17 84", role: "directeur", status: "ACTIF", mustChangePassword: false, createdAt: "2025-11-20T11:30" },

  /* ---- Comptes créés par inscription, en attente de validation par la direction ---- */
  { id: "u-req-eleve-1", schoolId: SCHOOL_IDS.sainteMarie, email: "aminata.sow@mail.sn", passwordHash: hashPassword("Eleve@2026"), firstName: "Aminata", lastName: "Sow", phone: "77 233 45 67", role: "eleve", status: "EN_ATTENTE", mustChangePassword: false, createdAt: "2026-12-15T08:20" },
  { id: "u-req-eleve-2", schoolId: SCHOOL_IDS.sainteMarie, email: "babacar.ndiaye@mail.sn", passwordHash: hashPassword("Eleve@2026"), firstName: "Babacar", lastName: "Ndiaye", phone: "78 455 12 09", role: "eleve", status: "EN_ATTENTE", mustChangePassword: false, createdAt: "2026-12-15T09:05" },
  { id: "u-req-parent-1", schoolId: SCHOOL_IDS.sainteMarie, email: "moussa.faye@mail.sn", passwordHash: hashPassword("Parent@2026"), firstName: "Moussa", lastName: "Faye", phone: "70 118 65 40", role: "parent", status: "EN_ATTENTE", mustChangePassword: false, createdAt: "2026-12-14T19:40" },
];

export interface DemoAccount {
  email: string;
  label: string;
  hint: string;
  icon: string;
  role: Role;
  schoolId: string;
  schoolName: string;
}

/** Codes des enfants du parent de démonstration (communiqués par l'école aux familles). */
export const DEMO_PARENT_CODES = childCodesOf("p-demo");

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "directeur@ecoleconnect.sn", label: "Directeur", hint: "Collège Sainte Marie · vue complète", icon: "admin_panel_settings", role: "directeur", schoolId: SCHOOL_IDS.sainteMarie, schoolName: "Collège Sainte Marie" },
  { email: "econome@ecoleconnect.sn", label: "Économe", hint: "Paiements et relances", icon: "payments", role: "econome", schoolId: SCHOOL_IDS.sainteMarie, schoolName: "Collège Sainte Marie" },
  { email: "instituteur@ecoleconnect.sn", label: "Instituteur · CM2 A", hint: "Toutes les matières de sa classe", icon: "child_care", role: "instituteur", schoolId: SCHOOL_IDS.sainteMarie, schoolName: "Collège Sainte Marie" },
  { email: "prof.maths@ecoleconnect.sn", label: "Prof. de Maths", hint: "6ème A, 5ème B, 3ème A · principal 5ème B", icon: "calculate", role: "professeur", schoolId: SCHOOL_IDS.sainteMarie, schoolName: "Collège Sainte Marie" },
  { email: "prof.francais@ecoleconnect.sn", label: "Prof. de Français", hint: "2nde L, Tle L", icon: "menu_book", role: "professeur", schoolId: SCHOOL_IDS.sainteMarie, schoolName: "Collège Sainte Marie" },
  { email: "surveillant@ecoleconnect.sn", label: "Surveillant général", hint: "Absences et discipline", icon: "shield_person", role: "surveillant", schoolId: SCHOOL_IDS.sainteMarie, schoolName: "Collège Sainte Marie" },
  { email: "eleve@ecoleconnect.sn", label: "Élève", hint: "Aïda Ndiaye · CE2 A", icon: "backpack", role: "eleve", schoolId: SCHOOL_IDS.sainteMarie, schoolName: "Collège Sainte Marie" },
  { email: "parent@ecoleconnect.sn", label: "Parent · 2 enfants", hint: "Codes enfants : voir l'aide", icon: "family_restroom", role: "parent", schoolId: SCHOOL_IDS.sainteMarie, schoolName: "Collège Sainte Marie" },
  { email: "direction@cheikhanta-ecole.sn", label: "Directeur · Cheikh Anta", hint: "Thiès · abonnement bientôt expiré", icon: "admin_panel_settings", role: "directeur", schoolId: SCHOOL_IDS.cheikhAnta, schoolName: "Groupe Scolaire Cheikh Anta" },
  { email: "contact@institut-horizon.sn", label: "Directeur · Institut Horizon", hint: "Mbour · école en lecture seule", icon: "admin_panel_settings", role: "directeur", schoolId: SCHOOL_IDS.horizon, schoolName: "Institut Horizon" },
  { email: "direction@teranga-ecole.sn", label: "Directeur · Teranga", hint: "Saint-Louis · accès bloqué", icon: "admin_panel_settings", role: "directeur", schoolId: SCHOOL_IDS.teranga, schoolName: "Complexe Scolaire Teranga" },
];