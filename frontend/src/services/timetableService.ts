import { supabase } from "@/lib/supabase";

export interface Timetable {
  id: string;
  name: string;
  school_year: string;
  status: "draft" | "published";
  course_count: number;
}

export interface TimetableCourse {
  id: string;
  timetable_id: string;
  subject_id: string;
  teacher_id: string;
  day: string;
  start_time: string;
  end_time: string;
  subject_name: string;
  teacher_name: string;
  room: string | undefined;
  description: string | undefined;
}

export interface CreateTimetableInput {
  name: string;
  classId: string;
  schoolYear?: string;
}

export interface CreateCourseInput {
  subjectId: string;
  teacherId: string;
  day: string;
  startTime: string;
  endTime: string;
  room?: string;
  description?: string;
}

export interface TimetableFilters {
  status?: "draft" | "published";
  className?: string;
}

async function transformTimetableRow(row: any): Promise<Timetable> {
  const courseCount = row?.timetable_courses?.length || 0;
  return {
    id: row.id,
    name: row.name,
    school_year: row.school_year,
    status: row.status,
    course_count: courseCount,
  };
}

async function transformTimetableCourseRow(row: any): Promise<TimetableCourse> {
  const subject = row?.subjects?.[0] || {};
  const profile = row?.profiles?.[0] || {};
  return {
    id: row.id,
    timetable_id: row?.timetable_id || row.id,
    subject_id: subject?.id || "",
    teacher_id: profile?.id || "",
    day: row.day,
    start_time: row.start_time,
    end_time: row.end_time,
    subject_name: subject?.name || "",
    teacher_name: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim(),
    room: row?.room,
    description: row?.description,
  };
}

export async function listTimetables(_filters?: TimetableFilters): Promise<Timetable[]> {
  // Récupération de base des emplois du temps
  const { data: timetables, error: tError } = await supabase
    .from("timetables")
    .select("id, name, school_year, status, class_id");

  if (tError) throw tError;
  if (!timetables) return [];

  // Récupération des noms de classes
  const classIds = timetables.map((t: any) => t.class_id);
  const { data: classes, error: cError } = await supabase
    .from("class_rooms")
    .select("id, name")
    .in("id", classIds);

  if (cError) throw cError;
  const classMap: Record<string, string> = {};
  classes.forEach((cl: any) => {
    classMap[cl.id] = cl.name;
  });

  // Compter les cours par emploi du temps
  const { data: courses, error: crError } = await supabase
    .from("timetable_courses")
    .select("timetable_id");

  if (crError) throw crError;
  const courseCounts: Record<string, number> = {};
  (courses as any[]).forEach((c: any) => {
    courseCounts[c.timetable_id] = (courseCounts[c.timetable_id] || 0) + 1;
  });

  // Association des données
  return timetables.map((t: any) => ({
    id: t.id,
    name: t.name,
    school_year: t.school_year,
    status: t.status,
    class_name: classMap[t.class_id] || "",
    course_count: courseCounts[t.id] || 0,
  }));
}

export async function getTimetable(timetableId: string): Promise<Timetable | null> {
  const { data, error } = await supabase
    .from("timetables")
    .select(
      `
      id,
      name,
      school_year,
      status,
      class_rooms (name),
      timetable_courses (id)
    `
    )
    .eq("id", timetableId)
    .single();

  if (error || !data) return null;

  return transformTimetableRow(data);
}

export async function createTimetable(input: CreateTimetableInput, schoolId: string, actorId: string): Promise<Timetable> {
  const { data, error } = await supabase
    .from("timetables")
    .insert({ school_id: schoolId, class_id: input.classId, name: input.name, school_year: input.schoolYear, created_by: actorId })
    .select()
    .single();

  if (error) throw error;

  return transformTimetableRow(data);
}

export async function updateTimetable(timetableId: string, updates: { name: string; schoolYear?: string }): Promise<void> {
  const { error } = await supabase
    .from("timetables")
    .update({ name: updates.name, school_year: updates.schoolYear })
    .eq("id", timetableId);

  if (error) throw error;
}

export async function deleteTimetable(timetableId: string): Promise<void> {
  // D'abord supprimer les cours
  await supabase.from("timetable_courses").delete().eq("timetable_id", timetableId);
  // Puis supprimer l'emploi du temps
  const { error } = await supabase.from("timetables").delete().eq("id", timetableId);
  if (error) throw error;
}

export async function publishTimetable(timetableId: string): Promise<void> {
  const { error } = await supabase
    .from("timetables")
    .update({ status: "published" })
    .eq("id", timetableId);

  if (error) throw error;
}

export async function addCourse(timetableId: string, input: CreateCourseInput): Promise<TimetableCourse> {
  const { data, error } = await supabase
    .from("timetable_courses")
    .insert({
      timetable_id: timetableId,
      subject_id: input.subjectId,
      teacher_id: input.teacherId,
      day: input.day,
      start_time: input.startTime,
      end_time: input.endTime,
      room: input.room,
      description: input.description,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    timetable_id: data.timetable_id,
    subject_id: data.subject_id,
    teacher_id: data.teacher_id,
    day: data.day,
    start_time: data.start_time,
    end_time: data.end_time,
    subject_name: "",
    teacher_name: "",
    room: data?.room,
    description: data?.description,
  };
}

export async function updateCourse(courseId: string, updates: Partial<CreateCourseInput>): Promise<TimetableCourse> {
  const { data, error } = await supabase
    .from("timetable_courses")
    .update({
      day: updates.day,
      start_time: updates.startTime,
      end_time: updates.endTime,
      room: updates.room,
      description: updates.description,
    })
    .eq("id", courseId)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    timetable_id: data.timetable_id,
    subject_id: data.subject_id,
    teacher_id: data.teacher_id,
    day: data.day,
    start_time: data.start_time,
    end_time: data.end_time,
    subject_name: "",
    teacher_name: "",
    room: data?.room,
    description: data?.description,
  };
}

export async function deleteCourse(courseId: string): Promise<void> {
  const { error } = await supabase.from("timetable_courses").delete().eq("id", courseId);
  if (error) throw error;
}

export async function duplicateCourse(courseId: string): Promise<TimetableCourse | null> {
  const course = await getCourse(courseId);
  if (!course) return null;

  const result = await addCourse(
    course.timetable_id!,
    {
      subjectId: course.subject_id,
      teacherId: course.teacher_id,
      day: course.day,
      startTime: course.start_time,
      endTime: course.end_time,
      room: course.room,
      description: course.description,
    }
  );
  return result || null;
}

export async function getCourse(courseId: string): Promise<TimetableCourse | null> {
  const { data, error } = await supabase
    .from("timetable_courses")
    .select(
      `*,
       subjects (name),
       profiles (first_name, last_name)`
    )
    .eq("id", courseId)
    .single();

  if (error || !data) return null;

  return transformTimetableCourseRow(data);
}