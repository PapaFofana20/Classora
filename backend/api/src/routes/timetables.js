/**
 * Timetable Management Handler
 * Routes: /api/timetables, /api/timetables/:id, /api/timetables/:id/publish, /api/timetables/:id/courses, /api/timetables/:id/export-pdf
 */

import { SERVICE_KEY, SUPABASE_URL } from "../config.js";
import { createClient } from "@supabase/supabase-js";
import { ok, route, serverError, forbidden, notFound } from "../lib/http.js";
import { expectObject } from "../lib/validate.js";

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

export default route(async (req, res) => {
  try {
    const id = req.params.id;

    if (!id) {
      if (req.method === "GET") {
        // GET /api/timetables - List timetables
        const schoolId = req.query.schoolId;
        let query = svc.from("timetables");
        if (schoolId) query = query.eq("school_id", schoolId);
        const { data, error } = await query.select().order("created_at", { ascending: false });
        if (error) return serverError(res, error.message);
        return ok(res, { timetables: data });
      }
      if (req.method === "POST") {
        // POST /api/timetables - Create
        const body = expectObject(req.body);
        const { data, error } = await svc.from("timetables").insert({
          school_id: body.schoolId,
          class_id: body.classId,
          name: body.name,
          school_year: body.schoolYear,
          status: "draft",
          created_by: req.user.id,
        }).select();
        if (error) return serverError(res, error.message);
        return ok(res, { timetable: data[0] }, 201);
      }
      return notFound(res);
    }

    if (id) {
      if (req.method === "GET") {
        // GET /api/timetables/:id - Get timetable
        const { data, error } = await svc.from("timetables").select("*").eq("id", id).single();
        if (error) return notFound(res);
        return ok(res, { timetable: data });
      }
      if (req.method === "PATCH") {
        // PATCH /api/timetables/:id - Update
        const body = expectObject(req.body);
        const { data, error } = await svc
          .from("timetables")
          .update({ name: body.name, school_year: body.schoolYear })
          .eq("id", id)
          .single();
        if (error) return serverError(res, error.message);
        return ok(res, { timetable: data });
      }
      if (req.method === "POST" && req.path.includes("/publish")) {
        // POST /api/timetables/:id/publish - Publish
        const { data, error } = await svc.from("timetables").update({ status: "published", published_at: new Date().toISOString() }).eq("id", id).single();
        if (error) return serverError(res, error.message);
        return ok(res, { timetable: data });
      }
      if (req.method === "POST" && (req.path.includes("/courses") || req.path.includes("/slots"))) {
        // POST /api/timetables/:id/courses - Add a course
        const body = expectObject(req.body);
        const { data, error } = await svc
          .from("timetable_courses")
          .insert({
            timetable_id: id,
            subject_id: body.subjectId,
            teacher_id: body.teacherId,
            day: body.day,
            start_time: body.startTime,
            end_time: body.endTime,
            room: body.room ?? null,
            description: body.description ?? null,
          })
          .select()
          .single();
        if (error) return serverError(res, error.message);
        return ok(res, { course: data }, 201);
      }
      if (req.method === "GET" && req.path.includes("/export-pdf")) {
        // GET /api/timetables/:id/export-pdf - Export PDF
        return ok(res, { message: "PDF export endpoint" });
      }
    }

    return notFound(res);
  } catch (e) {
    console.error("[timetables-handler]", e);
    return serverError(res);
  }
});