import type { Cycle, Role, SessionUser, StaffRole, Student, Teacher, User } from "@/types";
import { SCHOOL_YEAR, scaleFees, DEFAULT_ANNEX_FEES } from "@/data/school";
import { generateChildCode } from "@/utils/matricule";
import { hashPassword, verifyPassword } from "@/utils/passwordHash";
import { generateTempPassword } from "@/utils/password";
import { canManageStaff, isStaffRole } from "@/utils/permissions";
import { db, persist, respond, schoolOf, uid } from "./db";
import { buildPaymentPlan } from "./paymentService";

const SESSION_KEY = "classora_session";

function toSession(u: User): SessionUser {
  const { passwordHash: _hash, ...rest } = u;
  void _hash;
  return rest;
}

const emailTaken = (email: string): boolean => db.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase());

export function getStoredSession(): SessionUser | null {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    const user = id ? db.users.find((u) => u.id === id) : undefined;
    return user ? toSession(user) : null;
  } catch {
    return null;
  }
}

const startSession = (user: User): SessionUser => {
  localStorage.setItem(SESSION_KEY, user.id);
  return toSession(user);
};

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

/* ------------------------------------------------------------------ */
/* Connexion                                                            */
/* ------------------------------------------------------------------ */

/**
 * Connexion unique pour tous les rôles. Contrôles, dans l'ordre :
 * identifiants → compte désactivé → compte en attente d'approbation →
 * mot de passe temporaire (redirigé par MustChangePasswordGuard).
 * L'abonnement de l'école est traité plus loin par SubscriptionGuard :
 * l'utilisateur peut se connecter pour renouveler.
 */
export async function login(email: string, password: string): Promise<SessionUser> {
  const user = await respond(() => {
    const found = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!found || !verifyPassword(password, found.passwordHash)) throw new Error("E-mail ou mot de passe incorrect.");
    if (found.status === "DESACTIVE") throw new Error("Ce compte a été désactivé par la direction de votre école. Contactez votre école.");
    if (found.status === "EN_ATTENTE") throw new Error("Votre demande d'inscription est en attente de validation par votre école.");
    return found;
  });
  return startSession(user);
}

/* ------------------------------------------------------------------ */
/* Inscriptions publiques : directeur, élève, parent                    */
/* ------------------------------------------------------------------ */

export interface DirectorInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  schoolName: string;
  city: string;
  cycles: Cycle[];
}

/**
 * Inscription d'un directeur : il crée son école (sans abonnement ni matricule).
 * Session ouverte automatiquement, l'écran suivant est /app/abonnement.
 */
export async function registerDirector(input: DirectorInput): Promise<SessionUser> {
  const user = await respond(() => {
    if (emailTaken(input.email)) throw new Error("Un compte existe déjà avec cet e-mail.");
    const now = new Date().toISOString();
    const schoolId = uid("sch");
    const school = {
      id: schoolId,
      name: input.schoolName.trim(),
      matricule: "", // généré uniquement après un paiement réussi
      city: input.city.trim(),
      address: "",
      phone: input.phone.trim(),
      email: input.email.trim(),
      cycles: input.cycles,
      registrationOpen: true,
      autoApproveStudents: false,
      createdAt: now.slice(0, 10),
    };
    db.schools.push(school);
    db.settings.push({
      schoolId,
      name: school.name,
      address: "",
      phone: school.phone,
      email: school.email,
      schoolYear: SCHOOL_YEAR,
      cycles: input.cycles,
      periodType: "semestre",
      currentPeriod: "S1",
      fees: scaleFees(1),
      annexFees: { ...DEFAULT_ANNEX_FEES },
      siblingDiscount: 10,
    });
    db.subjects.push(
      ...[
        { id: "fr", name: "Français", cycles: input.cycles },
        { id: "math", name: "Mathématiques", cycles: input.cycles },
        { id: "hg", name: "Histoire-Géographie", cycles: input.cycles },
        { id: "eps", name: "Éducation physique et sportive", cycles: input.cycles },
      ].map((s) => ({ ...s, schoolId })),
    );
    const account: User = {
      id: uid("u"),
      schoolId,
      email: input.email.trim(),
      passwordHash: hashPassword(input.password),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone.trim(),
      role: "directeur",
      status: "ACTIF",
      mustChangePassword: false,
      createdAt: now,
    };
    db.users.push(account);
    persist();
    return account;
  }, 600, 900);
  return startSession(user);
}

export interface StudentSignupInput {
  schoolId: string;
  firstName: string;
  lastName: string;
  gender: "F" | "M";
  birthDate: string;
  classId: string;
  email: string;
  phone: string;
  password: string;
}

/** Inscription d'un élève : compte créé en attente, la direction valide ensuite. */
export async function registerStudent(input: StudentSignupInput): Promise<{ user: SessionUser; requestId: string }> {
  const result = await respond(() => {
    if (emailTaken(input.email)) throw new Error("Un compte existe déjà avec cet e-mail.");
    const school = schoolOf(input.schoolId);
    if (!school) throw new Error("École introuvable.");
    if (!db.classes.some((c) => c.schoolId === input.schoolId && c.id === input.classId)) throw new Error("Cette classe n'appartient pas à cette école.");
    const now = new Date().toISOString();
    const account: User = {
      id: uid("u"),
      schoolId: input.schoolId,
      email: input.email.trim(),
      passwordHash: hashPassword(input.password),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone.trim(),
      role: "eleve",
      status: "EN_ATTENTE",
      mustChangePassword: false,
      createdAt: now,
    };
    const requestId = uid("req");
    db.users.push(account);
    db.registrationRequests.push({
      id: requestId,
      schoolId: input.schoolId,
      userId: account.id,
      role: "eleve",
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      phone: account.phone,
      gender: input.gender,
      birthDate: input.birthDate,
      classId: input.classId,
      createdAt: now.slice(0, 10),
      status: "EN_ATTENTE",
    });
    // Option « approbation automatique » de l'école.
    if (school.autoApproveStudents) autoApprove(account, requestId);
    persist();
    return { user: account, requestId };
  }, 600, 900);
  const session = startSession(result.user);
  return { user: session, requestId: result.requestId };
}

export interface ParentSignupInput {
  schoolId: string;
  childCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
}

/** Inscription d'un parent : le code enfant rattache le compte à un élève de CETTE école. */
export async function registerParent(input: ParentSignupInput): Promise<{ user: SessionUser; requestId: string; childName: string }> {
  const result = await respond(() => {
    if (emailTaken(input.email)) throw new Error("Un compte existe déjà avec cet e-mail.");
    const school = schoolOf(input.schoolId);
    if (!school) throw new Error("École introuvable.");
    const child = db.students.find((s) => s.schoolId === input.schoolId && s.childCode.toUpperCase() === input.childCode.trim().toUpperCase());
    if (!child) throw new Error("Code élève introuvable dans cette école. Vérifiez le code reçu auprès de l'école.");
    const now = new Date().toISOString();
    const account: User = {
      id: uid("u"),
      schoolId: input.schoolId,
      email: input.email.trim(),
      passwordHash: hashPassword(input.password),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone.trim(),
      role: "parent",
      status: "EN_ATTENTE",
      mustChangePassword: false,
      createdAt: now,
    };
    const parentId = uid("p");
    db.parents.push({ schoolId: input.schoolId, id: parentId, firstName: account.firstName, lastName: account.lastName, phone: account.phone, email: account.email, address: "" });
    account.parentId = parentId;
    const requestId = uid("req");
    db.users.push(account);
    db.registrationRequests.push({
      id: requestId,
      schoolId: input.schoolId,
      userId: account.id,
      role: "parent",
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      phone: account.phone,
      classId: child.classId,
      childCode: child.childCode,
      createdAt: now.slice(0, 10),
      status: "EN_ATTENTE",
    });
    if (school.autoApproveStudents) autoApprove(account, requestId);
    persist();
    return { user: account, requestId, childName: `${child.firstName} ${child.lastName}` };
  }, 600, 900);
  return { user: startSession(result.user), requestId: result.requestId, childName: result.childName };
}

/** Rattachement d'un enfant supplémentaire (autre code) depuis l'espace parent. */
export async function linkChild(actor: SessionUser, childCode: string): Promise<Student> {
  return respond(() => {
    if (actor.role !== "parent" || !actor.parentId) throw new Error("Action réservée aux comptes parents.");
    const child = db.students.find((s) => s.schoolId === actor.schoolId && s.childCode.toUpperCase() === childCode.trim().toUpperCase());
    if (!child) throw new Error("Code élève introuvable dans votre école. Vérifiez le code reçu auprès de l'école.");
    if (child.parentId === actor.parentId) throw new Error("Cet enfant est déjà rattaché à votre compte.");
    child.parentId = actor.parentId;
    persist();
    return child;
  });
}

/* ------------------------------------------------------------------ */
/* Comptes créés par la direction (enseignants, économe, surveillant)   */
/* ------------------------------------------------------------------ */

export interface StaffAccountInput {
  role: StaffRole;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialties: string[];
  /** Mot de passe temporaire ; généré côté interface si vide. */
  tempPassword?: string;
}

export interface StaffCredentials {
  userId: string;
  email: string;
  /** Affiché UNE SEULE FOIS à la création ou à la réinitialisation. */
  tempPassword: string;
  firstName: string;
  lastName: string;
  role: Role;
}

/** Création d'un accès par le directeur (et uniquement par lui). */
export async function createStaffAccount(actor: SessionUser, input: StaffAccountInput): Promise<StaffCredentials> {
  return respond(() => {
    if (!canManageStaff(actor.role)) throw new Error("Seule la direction peut créer un accès.");
    if (!isStaffRole(input.role)) throw new Error("Rôle invalide.");
    if (emailTaken(input.email)) throw new Error("Un compte existe déjà avec cet e-mail.");
    const tempPassword = input.tempPassword?.trim() || generateTempPassword();
    const now = new Date().toISOString();
    const account: User = {
      id: uid("u"),
      schoolId: actor.schoolId,
      email: input.email.trim(),
      passwordHash: hashPassword(tempPassword),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone.trim(),
      role: input.role,
      status: "ACTIF",
      mustChangePassword: true,
      createdAt: now,
    };
    if (input.role === "instituteur" || input.role === "professeur") {
      const teacher: Teacher = {
        schoolId: actor.schoolId,
        id: uid("t"),
        firstName: account.firstName,
        lastName: account.lastName,
        kind: input.role === "instituteur" ? "instituteur" : "professeur",
        email: account.email,
        phone: account.phone,
        specialties: input.role === "instituteur" ? [] : input.specialties,
      };
      db.teachers.push(teacher);
      account.teacherId = teacher.id;
    }
    db.users.push(account);
    persist();
    return { userId: account.id, email: account.email, tempPassword, firstName: account.firstName, lastName: account.lastName, role: account.role };
  });
}

export function updateStaff(actor: SessionUser, userId: string, patch: { firstName?: string; lastName?: string; email?: string; phone?: string; specialties?: string[] }): Promise<User> {
  return respond(() => {
    const account = db.users.find((u) => u.id === userId && u.schoolId === actor.schoolId);
    if (!account) throw new Error("Compte introuvable dans votre école.");
    if (patch.email && patch.email.trim().toLowerCase() !== account.email.toLowerCase() && emailTaken(patch.email)) throw new Error("Un compte existe déjà avec cet e-mail.");
    Object.assign(account, {
      ...(patch.firstName !== undefined ? { firstName: patch.firstName.trim() } : {}),
      ...(patch.lastName !== undefined ? { lastName: patch.lastName.trim() } : {}),
      ...(patch.email !== undefined ? { email: patch.email.trim() } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone.trim() } : {}),
    });
    const teacher = account.teacherId ? db.teachers.find((t) => t.id === account.teacherId) : undefined;
    if (teacher && patch.specialties) teacher.specialties = patch.specialties;
    if (teacher && (patch.firstName || patch.lastName || patch.email || patch.phone)) {
      Object.assign(teacher, {
        firstName: account.firstName,
        lastName: account.lastName,
        email: account.email,
        phone: account.phone,
      });
    }
    persist();
    return account;
  });
}

/** Réinitialisation : nouveau mot de passe temporaire, affiché une seule fois. */
export function resetStaffPassword(actor: SessionUser, userId: string): Promise<StaffCredentials> {
  return respond(() => {
    const account = db.users.find((u) => u.id === userId && u.schoolId === actor.schoolId);
    if (!account) throw new Error("Compte introuvable dans votre école.");
    const tempPassword = generateTempPassword();
    account.passwordHash = hashPassword(tempPassword);
    account.mustChangePassword = true;
    persist();
    return { userId: account.id, email: account.email, tempPassword, firstName: account.firstName, lastName: account.lastName, role: account.role };
  });
}

/** Désactivation / réactivation : un compte désactivé ne peut plus se connecter. */
export function setStaffActive(actor: SessionUser, userId: string, active: boolean): Promise<User> {
  return respond(() => {
    const account = db.users.find((u) => u.id === userId && u.schoolId === actor.schoolId);
    if (!account) throw new Error("Compte introuvable dans votre école.");
    if (account.id === actor.id) throw new Error("Vous ne pouvez pas désactiver votre propre compte.");
    account.status = active ? "ACTIF" : "DESACTIVE";
    persist();
    return account;
  });
}

/** Changement de mot de passe (obligatoire à la première connexion d'un accès créé par la direction). */
export function changePassword(actor: SessionUser, currentPassword: string, nextPassword: string): Promise<User> {
  return respond(() => {
    const account = db.users.find((u) => u.id === actor.id);
    if (!account) throw new Error("Compte introuvable.");
    if (!verifyPassword(currentPassword, account.passwordHash)) throw new Error("Le mot de passe actuel est incorrect.");
    if (currentPassword === nextPassword) throw new Error("Choisissez un mot de passe différent de l'ancien.");
    account.passwordHash = hashPassword(nextPassword);
    account.mustChangePassword = false;
    persist();
    return account;
  }, 400, 700);
}

export function updateProfile(actor: SessionUser, patch: { firstName?: string; lastName?: string; email?: string; phone?: string }): Promise<User> {
  return respond(() => {
    const account = db.users.find((u) => u.id === actor.id);
    if (!account) throw new Error("Compte introuvable.");
    if (patch.email && patch.email.trim().toLowerCase() !== account.email.toLowerCase() && emailTaken(patch.email)) throw new Error("Un compte existe déjà avec cet e-mail.");
    Object.assign(account, {
      ...(patch.firstName !== undefined ? { firstName: patch.firstName.trim() } : {}),
      ...(patch.lastName !== undefined ? { lastName: patch.lastName.trim() } : {}),
      ...(patch.email !== undefined ? { email: patch.email.trim() } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone.trim() } : {}),
    });
    const teacher = account.teacherId ? db.teachers.find((t) => t.id === account.teacherId) : undefined;
    const parent = account.parentId ? db.parents.find((p) => p.id === account.parentId) : undefined;
    if (teacher) Object.assign(teacher, { firstName: account.firstName, lastName: account.lastName, email: account.email, phone: account.phone });
    if (parent) Object.assign(parent, { firstName: account.firstName, lastName: account.lastName, email: account.email, phone: account.phone });
    persist();
    return account;
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await respond(() => {
    // Pour des raisons de sécurité, on ne révèle pas si l'e-mail existe.
    void email;
    return true;
  });
}

/** Rattachement d'un compte parent à un enfant (validation par la direction). */
function autoApprove(account: User, requestId: string): void {
  const request = db.registrationRequests.find((r) => r.id === requestId);
  if (!request) return;
  request.status = "APPROUVEE";
  request.decidedAt = new Date().toISOString().slice(0, 10);
  account.status = "ACTIF";
  if (request.role === "eleve" && request.classId) {
    const student = linkAccountToStudent(account, request.classId, request.gender ?? "F", request.birthDate ?? "2015-01-01");
    db.payments.push(...buildPaymentPlan(student));
  }
}

/** Liste des accès du personnel d'une école (page /app/enseignants). */
export interface StaffRow {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: Role;
  status: User["status"];
  mustChangePassword: boolean;
  teacherId?: string;
  createdAt: string;
}

export const listStaff = (schoolId: string): Promise<StaffRow[]> =>
  respond(() =>
    db.users
      .filter((u) => u.schoolId === schoolId && u.role !== "directeur" && u.role !== "eleve" && u.role !== "parent")
      .map((u) => ({
        userId: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        mustChangePassword: u.mustChangePassword,
        ...(u.teacherId ? { teacherId: u.teacherId } : {}),
        createdAt: u.createdAt,
      }))
      .sort((a, b) => a.lastName.localeCompare(b.lastName, "fr")),
  );

/**
 * Rattachement immédiat d'un compte à son enfant (utilisé par l'approbation
 * automatique et par la validation d'une demande).
 */
export function linkAccountToStudent(account: User, classId: string, gender: "F" | "M", birthDate: string): Student {
  const now = new Date().toISOString().slice(0, 10);
  const parentId = db.parents.find((p) => p.email.toLowerCase() === account.email.toLowerCase())?.id ?? uid("p");
  if (!db.parents.some((p) => p.id === parentId)) {
    db.parents.push({ schoolId: account.schoolId, id: parentId, firstName: account.firstName, lastName: account.lastName, phone: account.phone, email: account.email, address: "" });
  }
  const student: Student = {
    schoolId: account.schoolId,
    id: uid("s"),
    matricule: `EC26${String(db.students.length + 1).padStart(4, "0")}`,
    childCode: generateChildCode(db.students.map((s) => s.childCode)),
    firstName: account.firstName,
    lastName: account.lastName,
    gender,
    birthDate,
    classId,
    parentId,
    options: { cantine: false, transport: false, tenue: false },
    enrolledAt: now,
  };
  db.students.push(student);
  account.studentId = student.id;
  return student;
}