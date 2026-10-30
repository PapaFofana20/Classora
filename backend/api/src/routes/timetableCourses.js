import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function listCourses(timetableId) {
  const { rows } = await pool.query(`
    select tc.*, s.name as subject_name, pr.first_name as teacher_first_name, pr.last_name as teacher_last_name
     from public.timetable_courses tc
     left join public.subjects s on tc.subject_id = s.id
     left join public.profiles pr on tc.teacher_id = pr.id
    where tc.timetable_id = $1
    order by tc.day, tc.start_time
  `, [timetableId])
  return rows
}

export async function getCourse(courseId) {
  const { rows } = await pool.query(`
    select tc.*, s.name as subject_name, pr.first_name as teacher_first_name, pr.last_name as teacher_last_name, c.name as class_name
     from public.timetable_courses tc
     left join public.subjects s on tc.subject_id = s.id
     left join public.profiles pr on tc.teacher_id = pr.id
     left join public.timetables t on tc.timetable_id = t.id
     left join public.class_rooms c on t.class_id = c.id
    where tc.id = $1
  `, [courseId])
  return rows.length > 0 ? rows[0] : null
}

export async function updateCourse(courseId, updates) {
  const { rows } = await pool.query(`
    update public.timetable_courses
       set day = $1, start_time = $2, end_time = $3, room = $4, description = $5, updated_at = timezone('utc'::text, now())
     where id = $6
     returning id, timetable_id, subject_id, teacher_id, day, start_time, end_time, room, description
  `, [updates.day, updates.startTime, updates.endTime, updates.room, updates.description, courseId])
  return rows.length > 0 ? rows[0] : null
}

export async function deleteCourse(courseId) {
  const { rows } = await pool.query(
    `delete from public.timetable_courses where id = $1 returning id`,
    [courseId]
  )
  return rows.length > 0
}

export async function duplicateCourse(courseId) {
  const course = await getCourse(courseId)
  if (!course) return null

  const { rows } = await pool.query(`
    insert into public.timetable_courses (timetable_id, subject_id, teacher_id, day, start_time, end_time, room, description)
    values ($1, $2, $3, $4, $5, $6, $7, $8)
    returning id, timetable_id, subject_id, teacher_id, day, start_time, end_time, room, description
  `, [course.timetable_id, course.subject_id, course.teacher_id, course.day, course.start_time, course.end_time, course.room, course.description])
  return rows[0]
}