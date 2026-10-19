import type { ClassRoom, ClassSubject, Cycle, Level, School, SchoolSettings, Subject } from "@/types";
import { levels } from "@/data/school";
import { generateMatricule, isValidMatricule, formatMatriculeInput } from "@/utils/matricule";
import { classSubjectsOf, classesOf, db, persist, respond, schoolOf, settingsOf, subjectsOf, uid } from "./db";
import { subscriptionInfoOf } from "./subscriptionService";

export interface SchoolOverview {
  levels: Level[];
  classes: ClassRoom[];
  subjects: Subject[];
  classSubjects: ClassSubject[];
  settings: SchoolSettings;
  school: School | null;
}

/** Matières de l'école courante + catalogue des niveaux. */
function snapshot(schoolId: string): SchoolOverview {
  return { levels, classes: classesOf(schoolId), subjects: subjectsOf(schoolId), classSubjects: classSubjectsOf(schoolId), settings: settingsOf(schoolId), school: schoolOf(schoolId) ?? null };
}

export const getSchoolOverview = (schoolId: string): Promise<SchoolOverview> => respond(() => snapshot(schoolId));

export const listSchools = (): Promise<School[]> => respond(() => db.schools, 150, 300);

export const getSchool = (schoolId: string): Promise<School | null> => respond(() => schoolOf(schoolId) ?? null, 150, 300);

export function updateSettings(schoolId: string, patch: Partial<SchoolSettings>): Promise<SchoolSettings> {
  return respond(() => {
    const s = settingsOf(schoolId);
    Object.assign(s, patch);
    persist();
    return s;
  });
}

/* ------------------------------------------------------------------ */
/* Matricule d'école                                                    */
/* ------------------------------------------------------------------ */

export interface MatriculeCheck {
  ok: boolean;
  school?: School;
  /** Motif du refus, null si le matricule est valide. */
  reason: "introuvable" | "inscriptions_fermees" | "abonnement_expire" | "abonnement_bloque" | "format" | null;
  message: string | null;
}

/**
 * Vérification du matricule saisie par un élève ou un parent.
 * Ordre des contrôles : format → école → inscriptions ouvertes → abonnement.
 */
export async function verifyMatricule(raw: string): Promise<MatriculeCheck> {
  const code = formatMatriculeInput(raw);
  if (!isValidMatricule(code)) {
    return { ok: false, reason: "format", message: "Le matricule comporte 5 caractères (lettres et chiffres, sans 0 ni O). Exemple : X7K9Q." };
  }
  return respond(() => {
    const school = db.schools.find((s) => s.matricule === code);
    if (!school) return { ok: false as const, reason: "introuvable" as const, message: "Matricule introuvable. Vérifiez auprès de votre école." };
    const info = subscriptionInfoOf(school.id);
    if (info.blocked) return { ok: false as const, school, reason: "abonnement_bloque" as const, message: `${school.name} n'accepte plus de nouvelles inscriptions. Contactez l'école pour plus d'informations.` };
    if (info.status === "EXPIRE") return { ok: false as const, school, reason: "abonnement_expire" as const, message: `${school.name} n'accepte pas de nouvelles inscriptions pour le moment. Contactez l'école.` };
    if (!school.registrationOpen) return { ok: false as const, school, reason: "inscriptions_fermees" as const, message: `Les inscriptions sont temporairement fermées à ${school.name}. Contactez l'école pour connaître la date de réouverture.` };
    return { ok: true as const, school, reason: null, message: null };
  }, 300, 600);
}

/** Génère (ou régénère explicitement) le matricule d'une école. */
export function generateMatriculeFor(schoolId: string): Promise<School> {
  return respond(() => {
    const school = schoolOf(schoolId);
    if (!school) throw new Error("École introuvable.");
    if (school.matricule) return school;
    school.matricule = generateMatricule(db.schools.map((s) => s.matricule).filter(Boolean));
    persist();
    return school;
  });
}

/** Interrupteur du directeur : ouvre ou ferme les inscriptions (le matricule ne change pas). */
export function toggleRegistration(schoolId: string, open: boolean): Promise<School> {
  return respond(() => {
    const school = schoolOf(schoolId);
    if (!school) throw new Error("École introuvable.");
    school.registrationOpen = open;
    persist();
    return school;
  });
}

/** Option des paramètres : approbation automatique des élèves (désactivée par défaut). */
export function setAutoApprove(schoolId: string, value: boolean): Promise<School> {
  return respond(() => {
    const school = schoolOf(schoolId);
    if (!school) throw new Error("École introuvable.");
    school.autoApproveStudents = value;
    persist();
    return school;
  });
}

export function updateSchool(schoolId: string, patch: Partial<Pick<School, "name" | "city" | "address" | "phone" | "email" | "cycles">>): Promise<School> {
  return respond(() => {
    const school = schoolOf(schoolId);
    if (!school) throw new Error("École introuvable.");
    Object.assign(school, patch);
    const s = settingsOf(schoolId);
    if (patch.name) s.name = patch.name;
    if (patch.address) s.address = patch.address;
    if (patch.phone) s.phone = patch.phone;
    if (patch.email) s.email = patch.email;
    if (patch.cycles) s.cycles = patch.cycles;
    persist();
    return school;
  });
}

/* ------------------------------------------------------------------ */
/* Classes, matières, coefficients                                      */
/* ------------------------------------------------------------------ */

export function setClassSubject(schoolId: string, classId: string, subjectId: string, coefficient: number | null): Promise<ClassSubject[]> {
  return respond(() => {
    const cls = classesOf(schoolId).find((c) => c.id === classId);
    if (!cls) throw new Error("Classe introuvable.");
    const idx = db.classSubjects.findIndex((x) => x.classId === classId && x.subjectId === subjectId);
    if (coefficient === null) {
      if (idx >= 0) db.classSubjects.splice(idx, 1);
      db.assignments = db.assignments.filter((a) => !(a.schoolId === schoolId && a.classId === classId && a.subjectId === subjectId));
    } else if (idx >= 0) {
      db.classSubjects[idx].coefficient = coefficient;
    } else {
      db.classSubjects.push({ schoolId, classId, subjectId, coefficient });
      // Règle élémentaire : le titulaire reçoit automatiquement la nouvelle matière
      if (cls.cycle === "elementaire" && cls.headTeacherId) {
        db.assignments.push({ schoolId, teacherId: cls.headTeacherId, classId, subjectId });
      }
    }
    persist();
    return db.classSubjects.filter((x) => x.schoolId === schoolId && x.classId === classId);
  });
}

export function addSubject(schoolId: string, name: string, cycles: Cycle[]): Promise<Subject> {
  return respond(() => {
    const mine = subjectsOf(schoolId);
    if (mine.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) throw new Error("Cette matière existe déjà.");
    const id = name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .slice(0, 12);
    const subject: Subject = { schoolId, id: db.subjects.some((s) => s.id === id) ? `${id}_${uid("").slice(-3)}` : id, name: name.trim(), cycles };
    db.subjects.push(subject);
    persist();
    return subject;
  });
}

export interface NewClassInput {
  levelId: string;
  section: string;
  series?: string;
  capacity: number;
}

export function createClass(schoolId: string, input: NewClassInput): Promise<ClassRoom> {
  return respond(() => {
    const level = levels.find((l) => l.id === input.levelId);
    if (!level) throw new Error("Niveau introuvable.");
    const name = `${level.label === "Terminale" ? "Tle" : level.label}${input.series ? " " + input.series : " " + input.section.toUpperCase()}`;
    const mine = classesOf(schoolId);
    if (mine.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw new Error(`La classe « ${name} » existe déjà.`);
    const cls: ClassRoom = {
      schoolId,
      id: uid("c"),
      name,
      levelId: level.id,
      cycle: level.cycle,
      ...(input.series ? { series: input.series } : {}),
      headTeacherId: null,
      capacity: input.capacity,
    };
    db.classes.push(cls);
    const template = mine.find((c) => c.levelId === level.id && c.series === cls.series) ?? mine.find((c) => c.cycle === level.cycle);
    if (template) {
      classSubjectsOf(schoolId)
        .filter((x) => x.classId === template.id)
        .forEach((x) => db.classSubjects.push({ ...x, classId: cls.id }));
    }
    persist();
    return cls;
  });
}

export function deleteClass(schoolId: string, classId: string): Promise<void> {
  return respond(() => {
    if (db.students.some((s) => s.schoolId === schoolId && s.classId === classId)) throw new Error("Impossible de supprimer une classe qui contient des élèves.");
    db.classes = db.classes.filter((c) => !(c.schoolId === schoolId && c.id === classId));
    db.classSubjects = db.classSubjects.filter((x) => !(x.schoolId === schoolId && x.classId === classId));
    db.assignments = db.assignments.filter((a) => !(a.schoolId === schoolId && a.classId === classId));
    persist();
  });
}

export function updateClassCapacity(schoolId: string, classId: string, capacity: number): Promise<void> {
  return respond(() => {
    const c = classesOf(schoolId).find((x) => x.id === classId);
    if (c) c.capacity = capacity;
    persist();
  });
}

/* ------------------------------------------------------------------ */
/* Classes ouvertes à l'inscription (utilisé par /inscription)          */
/* ------------------------------------------------------------------ */

export interface OpenClass {
  id: string;
  name: string;
  cycle: Cycle;
  levelLabel: string;
  capacity: number;
  filled: number;
}

export const openClassesFor = (schoolId: string): Promise<OpenClass[]> =>
  respond(() =>
    classesOf(schoolId)
      .map((c) => ({
        id: c.id,
        name: c.name,
        cycle: c.cycle,
        levelLabel: levels.find((l) => l.id === c.levelId)?.label ?? "",
        capacity: c.capacity,
        filled: db.students.filter((s) => s.schoolId === schoolId && s.classId === c.id).length,
      }))
      .filter((c) => c.filled < c.capacity)
      .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true })),
  );