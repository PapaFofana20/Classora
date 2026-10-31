import { SCHOOL_YEAR } from "@/data/school";
import { supabase } from "@/lib/supabase";

/**
 * Le schéma réellement déployé sur Supabase utilise `timetables` + `timetable_courses`
 * (et non `timetable_slots`). Toutes les requêtes du module passent par ce service.
 */

export interface TimetableClassRef {
  name: string | null;
  levels?: { label: string | null } | { label: string | null }[] | null;
}

export interface Timetable {
  id: string;
  school_id: string;
  name: string;
  class_id: string;
  school_year: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  class_rooms?: TimetableClassRef | null;
  timetable_courses?: { id: string }[] | null;
}

export interface TimetableCourse {
  id: string;
  timetable_id: string;
  subject_id: string;
  teacher_id: string;
  day: string;
  start_time: string;
  end_time: string;
  room: string | null;
  description: string | null;
  subjects?: { name: string | null } | { name: string | null }[] | null;
  teachers?: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
}

export interface CreateTimetableInput {
  name: string;
  classId: string;
  schoolYear?: string;
}

export interface TimetableSubjectOption {
  id: string;
  name: string;
}

export interface TimetableTeacherOption {
  id: string;
  first_name: string;
  last_name: string;
}

export interface CourseInput {
  subjectId: string;
  teacherId: string;
  /** Jour en minuscules : lundi … samedi (contrainte de la base). */
  day: string;
  /** Heure au format HH:MM. */
  startTime: string;
  /** Heure au format HH:MM. */
  endTime: string;
  room?: string;
  description?: string;
}

const TIMETABLE_SELECT =
  "id, school_id, name, class_id, school_year, status, created_by, created_at, updated_at, published_at, class_rooms(name, levels(label))";

/** PostgREST renvoie tantôt un objet, tantôt un tableau pour une relation imbriquée. */
function first<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function courseSubject(course: TimetableCourse): string {
  return first(course.subjects)?.name ?? "Matière non spécifiée";
}

export function courseTeacher(course: TimetableCourse): string {
  const teacher = first(course.teachers);
  const name = `${teacher?.first_name ?? ""} ${teacher?.last_name ?? ""}`.trim();
  return name || "Enseignant non assigné";
}

export function timetableClassLabel(timetable: Timetable): string {
  const room = timetable.class_rooms;
  const level = first(room?.levels)?.label ?? null;
  if (room?.name && level) return `${room.name} · ${level}`;
  return room?.name ?? level ?? "Classe non spécifiée";
}

export function timetableCourseCount(timetable: Timetable): number {
  return timetable.timetable_courses?.length ?? 0;
}

export async function listTimetables(schoolId: string): Promise<Timetable[]> {
  const { data, error } = await supabase
    .from("timetables")
    .select(`${TIMETABLE_SELECT}, timetable_courses(id)`)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Timetable[];
}

export async function getTimetable(timetableId: string): Promise<{ timetable: Timetable; courses: TimetableCourse[] }> {
  const [{ data: timetable, error: timetableError }, { data: courses, error: coursesError }] = await Promise.all([
    supabase.from("timetables").select(TIMETABLE_SELECT).eq("id", timetableId).single(),
    supabase
      .from("timetable_courses")
      .select("*, subjects(name), teachers(first_name, last_name)")
      .eq("timetable_id", timetableId)
      .order("start_time"),
  ]);

  if (timetableError) throw timetableError;
  if (coursesError) throw coursesError;

  return {
    timetable: timetable as unknown as Timetable,
    courses: (courses ?? []) as unknown as TimetableCourse[],
  };
}

export async function listTimetableSubjects(schoolId: string): Promise<TimetableSubjectOption[]> {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("school_id", schoolId)
    .order("name");

  if (error) throw error;
  return (data ?? []) as TimetableSubjectOption[];
}

export async function listTimetableTeachers(schoolId: string): Promise<TimetableTeacherOption[]> {
  const { data, error } = await supabase
    .from("teachers")
    .select("id, first_name, last_name")
    .eq("school_id", schoolId)
    .order("last_name");

  if (error) throw error;
  return (data ?? []) as TimetableTeacherOption[];
}

/**
 * La table `timetable_courses` exige un enseignant. Tant que l'école n'en a
 * aucun, on crée (une seule fois) un enseignant « à définir » pour permettre
 * au directeur de remplir la maquette. Il pourra être remplacé plus tard.
 */
export async function ensurePlaceholderTeacher(schoolId: string): Promise<string> {
  const email = `enseignant-a-definir+${schoolId}@classora.local`;

  const find = async (): Promise<string | null> => {
    const { data, error } = await supabase
      .from("teachers")
      .select("id")
      .eq("school_id", schoolId)
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    return (data as { id: string } | null)?.id ?? null;
  };

  const existing = await find();
  if (existing) return existing;

  const { data, error } = await supabase
    .from("teachers")
    .insert({
      school_id: schoolId,
      kind: "professeur",
      first_name: "Enseignant",
      last_name: "à définir",
      email,
      phone: "",
      specialties: [],
    })
    .select("id")
    .single();

  if (error) {
    // Course possible entre deux enregistrements : on relit la ligne créée.
    const retry = await find();
    if (retry) return retry;
    throw error;
  }

  return (data as { id: string }).id;
}

export async function createTimetable(input: CreateTimetableInput, schoolId: string, actorId: string): Promise<string> {
  const { data, error } = await supabase
    .from("timetables")
    .insert({
      school_id: schoolId,
      class_id: input.classId,
      name: input.name,
      school_year: input.schoolYear?.trim() || SCHOOL_YEAR,
      status: "draft",
      created_by: actorId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

export async function publishTimetable(timetableId: string): Promise<void> {
  const { error } = await supabase
    .from("timetables")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", timetableId);

  if (error) throw error;
}

export async function unpublishTimetable(timetableId: string): Promise<void> {
  const { error } = await supabase
    .from("timetables")
    .update({ status: "draft", published_at: null })
    .eq("id", timetableId);

  if (error) throw error;
}

/** Convertit "HH:MM" en "HH:MM:00" (format attendu par Postgres pour les colonnes time). */
function normalizeTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

export async function createCourse(timetableId: string, input: CourseInput): Promise<void> {
  const { error } = await supabase.from("timetable_courses").insert({
    timetable_id: timetableId,
    subject_id: input.subjectId,
    teacher_id: input.teacherId,
    day: input.day,
    start_time: normalizeTime(input.startTime),
    end_time: normalizeTime(input.endTime),
    room: input.room?.trim() || null,
    description: input.description?.trim() || null,
  });

  if (error) throw error;
}

export async function updateCourse(courseId: string, input: CourseInput): Promise<void> {
  const { error } = await supabase
    .from("timetable_courses")
    .update({
      subject_id: input.subjectId,
      teacher_id: input.teacherId,
      day: input.day,
      start_time: normalizeTime(input.startTime),
      end_time: normalizeTime(input.endTime),
      room: input.room?.trim() || null,
      description: input.description?.trim() || null,
    })
    .eq("id", courseId);

  if (error) throw error;
}

export async function deleteCourse(courseId: string): Promise<void> {
  const { error } = await supabase.from("timetable_courses").delete().eq("id", courseId);
  if (error) throw error;
}

export async function deleteTimetable(timetableId: string): Promise<void> {
  const { error } = await supabase.from("timetables").delete().eq("id", timetableId);
  if (error) throw error;
}
