import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function listTimetables(schoolId) {
  const { rows } = await pool.query(
    `select t.id, t.name, t.school_year, t.status, 
      count(tc.id) as course_count,
      string_agg(distinct c.name, ', ') as class_name
     from public.timetables t
     left join public.class_rooms c on t.class_id = c.id
     left join public.timetable_courses tc on t.id = tc.timetable_id
    where t.school_id = $1
    group by t.id, t.name, t.school_year, t.status, c.name
    order by t.updated_at desc`,
    [schoolId]
  );
  return rows;
}

export async function getTimetable(timetableId, schoolId) {
  const { rows } = await pool.query(
    `select t.id, t.name, t.school_year, t.status, 
      (select count(*) from public.timetable_courses tc where tc.timetable_id = t.id) as course_count,
      c.name as class_name
     from public.timetables t
     left join public.class_rooms c on t.class_id = c.id
    where t.id = $1 and t.school_id = $2`,
    [timetableId, schoolId]
  );
  if (rows.length === 0) return null;

  const { rows: courses } = await pool.query(
    `select tc.*, s.name as subject_name, pr.first_name as teacher_first_name, pr.last_name as teacher_last_name
     from public.timetable_courses tc
     left join public.subjects s on tc.subject_id = s.id
     left join public.profiles pr on tc.teacher_id = pr.id
    where tc.timetable_id = $1
    order by tc.day, tc.start_time`,
    [timetableId]
  );
  rows[0].courses = courses;
  return rows[0];
}

export async function createTimetable(schoolId, classId, name, schoolYear, actorId) {
  const { rows } = await pool.query(
    `insert into public.timetables (school_id, class_id, name, school_year, created_by)
     values ($1, $2, $3, $4, $5)
     returning id, school_id, class_id, name, school_year, status, created_at`,
    [schoolId, classId, name, schoolYear, actorId]
  );
  return rows[0];
}

export async function updateTimetable(timetableId, schoolId, updates, actorId) {
  // Vérifier que le directeur est propriétaire
  const { rows: timetable } = await pool.query(
    `select created_by from public.timetables where id = $1 and school_id = $2`,
    [timetableId, schoolId]
  );
  if (timetable.length === 0) return null;

  await pool.query(
    `update public.timetables set name = $1, school_year = $2, updated_at = timezone('utc'::text, now())
     where id = $3`,
    [updates.name, updates.schoolYear, timetableId]
  );
  return { id: timetableId, ...updates, schoolId };
}

export async function deleteTimetable(timetableId, schoolId, actorId) {
  // Vérifier que le directeur est propriétaire
  const { rows: timetable } = await pool.query(
    `select created_by from public.timetables where id = $1 and school_id = $2`,
    [timetableId, schoolId]
  );
  if (timetable.length === 0) return false;

  await pool.query(`delete from public.timetable_courses where timetable_id = $1`, [timetableId]);
  await pool.query(`delete from public.timetables where id = $1`, [timetableId]);
  return true;
}

export async function publishTimetable(timetableId, schoolId, actorId) {
  // Vérifier que le directeur est propriétaire
  const { rows: timetable } = await pool.query(
    `select created_by from public.timetables where id = $1 and school_id = $2`,
    [timetableId, schoolId]
  );
  if (timetable.length === 0) return null;

  // Vérifier qu'il n'y a pas de conflits
  const conflicts = await checkConflicts(timetableId);
  if (conflicts.length > 0) {
    throw new Error(`Conflits détectés : ${conflicts.map(c => c.message).join('; ')}`);
  }

  await pool.query(
    `update public.timetables set status = 'published', published_at = timezone('utc'::text, now()) where id = $1`,
    [timetableId]
  );
  return { id: timetableId, status: 'published', publishedAt: new Date() };
}

async function checkConflicts(timetableId) {
  const { rows } = await pool.query(`
    select tc1.id, tc1.day, tc1.start_time, tc1.end_time,
           tc1.teacher_id, tc1.class_id,
           case when tc1.teacher_id = tc2.teacher_id then 'enseignant en double'
                when tc1.class_id = tc2.class_id then 'classe en double' end as conflict_type
     from public.timetable_courses tc1
     join public.timetable_courses tc2 on tc1.id != tc2.id and tc1.timetable_id = $1
     where (tc1.start_time < tc2.end_time and tc1.end_time > tc2.start_time)
       and tc1.day = tc2.day
  `, [timetableId]);

  const result = [];
  for (const row of rows) {
    result.push({
      id: row.id,
      day: row.day,
      start_time: row.start_time,
      end_time: row.end_time,
      conflict_type: row.conflict_type,
      message: `Conflit ${row.conflict_type} le ${row.day} de ${row.start_time} à ${row.end_time}`
    });
  }
  return result;
}

export async function addCourse(timetableId, subjectId, teacherId, day, startTime, endTime, room, description) {
  const { rows } = await pool.query(
    `insert into public.timetable_courses (timetable_id, subject_id, teacher_id, day, start_time, end_time, room, description)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, timetable_id, subject_id, teacher_id, day, start_time, end_time, room, description`,
    [timetableId, subjectId, teacherId, day, startTime, endTime, room, description]
  );
  return rows[0];
}

export async function updateCourse(courseId, updates) {
  const { rows } = await pool.query(
    `update public.timetable_courses set day = $1, start_time = $2, end_time = $3, room = $4, description = $5, updated_at = timezone('utc'::text, now())
     where id = $6
     returning id, timetable_id, subject_id, teacher_id, day, start_time, end_time, room, description`,
    [updates.day, updates.startTime, updates.endTime, updates.room, updates.description, courseId]
  );
  return rows[0];
}

export async function deleteCourse(courseId) {
  const { rows } = await pool.query(
    `delete from public.timetable_courses where id = $1 returning id`,
    [courseId]
  );
  return rows.length > 0;
}