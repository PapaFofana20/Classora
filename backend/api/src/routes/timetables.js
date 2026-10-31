/**
 * Timetable Management Handler
 * Routes: /api/timetables, /api/timetables/:id, /api/timetables/:id/publish, /api/timetables/:id/slots, /api/timetables/:id/export-pdf
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
          title: body.title,
          school_id: body.schoolId,
          class_id: body.classId,
          grade_level: body.gradeLevel,
          period_type: body.periodType,
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
        const { data, error } = await svc.from("timetables").update({ title: req.body.title }).eq("id", id).single();
        if (error) return serverError(res, error.message);
        return ok(res, { timetable: data });
      }
      if (req.method === "POST" && req.path.includes("/publish")) {
        // POST /api/timetables/:id/publish - Publish
        const { data, error } = await svc.from("timetables").update({ status: "published", published_at: new Date().toISOString() }).eq("id", id).single();
        if (error) return serverError(res, error.message);
        return ok(res, { timetable: data });
      }
      if (req.method === "POST" && req.path.includes("/slots")) {
        // POST /api/timetables/:id/slots - Add slots
        const { data, error } = await svc.from("timetable_slots").insert([{ timetable_id: id, day_of_week: 0, start_time: "08:00", end_time: "09:00", subject: "Test" }]).single();
        if (error) return serverError(res, error.message);
        return ok(res, { slots: data });
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