import type { SessionUser, Teacher } from "@/types";
import { ensureWritable } from "./access";
import { supabase } from "@/lib/supabase";
import { assignmentsOf, classesOf, db, hydrate, subjectsOf, teachersOf } from "./db";

export interface TeacherRow extends Teacher {
  classNames: string[];
  subjectNames: string[];
  assignmentCount: number;
  headOf: string[];
  /** Identifiant du compte d'accès, s'il existe (le directeur peut l'avoir créé). */
  userId?: string;
  accountStatus?: "ACTIF" | "DESACTIVE" | "EN_ATTENTE";
  mustChangePassword?: boolean;
}

export function listTeacherRows(schoolId: string): Promise<TeacherRow[]> {
  return (async () => {
    await Promise.all([hydrate("teachers"), hydrate("assignments"), hydrate("classes"), hydrate("users")]);
    const classes = classesOf(schoolId);
    const subjects = subjectsOf(schoolId);
    const assignments = assignmentsOf(schoolId);
    const users = db.users.filter((u) => u.schoolId === schoolId);
    return teachersOf(schoolId).map((t) => {
      const mine = assignments.filter((a) => a.teacherId === t.id);
      const account = users.find((u) => u.teacherId === t.id);
      return {
        ...t,
        classNames: Array.from(new Set(mine.map((a) => classes.find((c) => c.id === a.classId)?.name ?? ""))).filter(Boolean),
        subjectNames: Array.from(new Set(mine.map((a) => subjects.find((s) => s.id === a.subjectId)?.name ?? ""))).filter(Boolean),
        assignmentCount: mine.length,
        headOf: classes.filter((c) => c.headTeacherId === t.id).map((c) => c.name),
        ...(account ? { userId: account.id, accountStatus: account.status, mustChangePassword: account.mustChangePassword } : {}),
      };
    });
  })();
}

export interface NewTeacherInput {
  firstName: string;
  lastName: string;
  kind: Teacher["kind"];
  email: string;
  phone: string;
  specialties: string[];
}

export function createTeacher(actor: SessionUser, input: NewTeacherInput): Promise<Teacher> {
  return (async () => {
    ensureWritable(actor);
    if (teachersOf(actor.schoolId).some((t) => t.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error("Un enseignant avec cet e-mail existe déjà dans votre école.");
    }
    const { data, error } = await supabase
      .from("teachers")
      .insert({
        school_id: actor.schoolId,
        kind: input.kind,
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        specialties: input.specialties,
      })
      .select("id")
      .single();
    if (error) {
      if (/row-level security/.test(error.message) || /règle/i.test(error.message)) {
        throw new Error("Seule la direction peut créer un enseignant.");
      }
      if (/exists|duplicate|unique/i.test(error.message)) {
        throw new Error("Un enseignant avec cet e-mail existe déjà dans votre école.");
      }
      throw new Error(error.message);
    }
    await hydrate("teachers");
    const teacher = teachersOf(actor.schoolId).find((t) => t.id === (data as { id: string }).id);
    if (!teacher) throw new Error("Enseignant introuvable après création.");
    return teacher;
  })();
}

export function deleteTeacher(actor: SessionUser, id: string): Promise<void> {
  return (async () => {
    ensureWritable(actor);
    const { error } = await supabase.from("teachers").delete().eq("id", id).eq("school_id", actor.schoolId);
    if (error) {
      throw new Error(/in use/i.test(error.message)
        ? "Cet enseignant a des affectations ou bulletins associés. Déplacez-les d'abord."
        : error.message);
    }
    await Promise.all([hydrate("teachers"), hydrate("assignments"), hydrate("classes")]);
  })();
}
