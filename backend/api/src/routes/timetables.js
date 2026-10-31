/**
 * Timetable Management Routes with Security Fixes
 * - Directors can create, update, publish timetables
 * - Teachers, students, parents can view timetables (with proper RBAC)
 * - PDF export only for authorized users
 */

import { SERVICE_KEY, SUPABASE_URL } from "../config.js";
import { createClient } from "@supabase/supabase-js";
import { ok, route, serverError, forbidden, notFound } from "../lib/http.js";
import { expectObject } from "../lib/validate.js";

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

/**
 * GET /api/timetables/:id - Get a specific timetable (with permission check)
 */
export default route(async (req, res) => {
  if (req.method !== "GET") return ok(res, { error: "Méthode non autorisée." }, 405);

  try {
    const { id } = req.params;

    const { data, error } = await svc.from("timetables")
      .select(`
        *,
        profiles!timetables_created_by_fkey (id, full_name, role)
      `)
      .eq("id", id)
      .single();

    if (error) return notFound(res, "Emploi du temps introuvable.");

    // Check if user can view this timetable
    const canView = await checkTimetableViewer(svc, req.user, data.id);

    if (!canView) return forbidden(res, "Accès refusé à cet emploi du temps.");

    return ok(res, { timetable: data });
  } catch (e) {
    console.error("[timetables-get]", e);
    return serverError(res);
  }
});
/**
 * PATCH /api/timetables/:id - Update a timetable (directors only)
 */
export default route(async (req, res) => {
  if (req.method !== "PATCH") return ok(res, { error: "Méthode non autorisée." }, 405);

  try {
    const { id } = req.params;
    const body = expectObject(req.body);

    // Verify director has access to this timetable
    const { data: timetable, error: fetchError } = await svc.from("timetables")
      .select("school_id, created_by")
      .eq("id", id)
      .single();

    if (fetchError || !timetable) return notFound(res, "Emploi du temps introuvable.");

    // Check if user is director of the school
    const { data: userProfile, error: userError } = await svc.from("profiles")
      .select("role, school_id")
      .eq("id", req.user.id)
      .single();

    if (userError || !userProfile || userProfile.role !== "directeur" || userProfile.school_id !== timetable.school_id) {
      return forbidden(res, "Seul le directeur peut modifier cet emploi du temps.");
    }

    // Update the timetable
    const updateData = {
      title: body.title,
      description: body.description,
      class_id: body.class_id,
      grade_level: body.grade_level,
      period_type: body.period_type,
    };
/**
 * POST /api/timetables/:id/publish - Publish a timetable (directors only)
 */
export default route(async (req, res) => {
  if (req.method !== "POST") return ok(res, { error: "Méthode non autorisée." }, 405);

  try {
    const { id } = req.params;

    // Verify director has access to this timetable
    const { data: timetable, error: fetchError } = await svc.from("timetables")
      .select("school_id, created_by")
      .eq("id", id)
      .single();

    if (fetchError || !timetable) return notFound(res, "Emploi du temps introuvable.");

    // Check if user is director of the school
    const { data: userProfile, error: userError } = await svc.from("profiles")
      .select("role, school_id")
      .eq("id", req.user.id)
      .single();

    if (userError || !userProfile || userProfile.role !== "directeur" || userProfile.school_id !== timetable.school_id) {
      return forbidden(res, "Seul le directeur peut publier cet emploi du temps.");
    }

    // Update status to published
    const { data, error } = await svc.from("timetables")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", id)
      .select();

    if (error) return serverError(res, error.message);

    return ok(res, { timetable: data[0] });
  } catch (e) {
    console.error("[timetables-publish]", e);
    return serverError(res);
/**
 * POST /api/timetables/:id/slots - Add time slots to a timetable (directors only)
 */
export default route(async (req, res) => {
  if (req.method !== "POST") return ok(res, { error: "Méthode non autorisée." }, 405);

  try {
    const { id } = req.params;
    const body = expectObject(req.body);

    // Verify director has access to this timetable
    const { data: timetable, error: fetchError } = await svc.from("timetables")
      .select("school_id, created_by")
      .eq("id", id)
      .single();

    if (fetchError || !timetable) return notFound(res, "Emploi du temps introuvable.");

    // Check if user is director of the school
    const { data: userProfile, error: userError } = await svc.from("profiles")
      .select("role, school_id")
      .eq("id", req.user.id)
      .single();

    if (userError || !userProfile || userProfile.role !== "directeur" || userProfile.school_id !== timetable.school_id) {
      return forbidden(res, "Seul le directeur peut ajouter des créneaux.");
    }

    // Validate slots
    const slots = body.slots;
    if (!Array.isArray(slots) || slots.length === 0) {
      return badRequest(res, "Au moins un créneau horaire est requis.");
    }

    // Insert the slots
    const { data, error } = await svc.from("timetable_slots").insert(
      slots.map(slot => ({
        timetable_id: id,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
/**
 * GET /api/timetables/:id/export-pdf - Export timetable as PDF (authorized viewers only)
 */
export default route(async (req, res) => {
  if (req.method !== "GET") return ok(res, { error: "Méthode non autorisée." }, 405);

  try {
    const { id } = req.params;

    // Get the timetable data
    const { data: timetable, error: fetchError } = await svc.from("timetables")
      .select(`
        *,
        profiles!timetables_created_by_fkey (id, full_name, role),
        class_rooms!timetables_class_id_fkey (id, label, level)
      `)
      .eq("id", id)
      .single();

    if (fetchError || !timetable) return notFound(res, "Emploi du temps introuvable.");

    // Check if user can view this timetable (and thus export PDF)
    const canView = await checkTimetableViewer(svc, req.user, timetable.id);

    if (!canView) return forbidden(res, "Accès refusé à l'export de cet emploi du temps.");

    // Get the slots
    const { data: slots, error: slotsError } = await svc.from("timetable_slots")
      .select("*")
      .eq("timetable_id", id)
      .order("day_of_week")
      .order("start_time");

    if (slotsError) return serverError(res, slotsError.message);

    // Generate PDF
    const pdfBuffer = await generatePdfFromTimetable(timetable, slots);

    // Set headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
/**
 * Helper function to check if user can view a timetable
 */
async function checkTimetableViewer(svc, viewer, timetableId) {
  // Get the timetable
  const { data: timetable, error } = await svc.from("timetables")
    .select("school_id, class_id")
    .eq("id", timetableId)
    .single();

  if (error) return false;

  // Directors can always view
  const { data: viewerProfile, error: profileError } = await svc.from("profiles")
    .select("role, school_id")
    .eq("id", viewer.id)
    .single();

  if (profileError || !viewerProfile) return false;

  if (viewerProfile.role === "directeur" && viewerProfile.school_id === timetable.school_id) {
    return true;
  }

  // Teachers can view if they're assigned to the class
  if (viewerProfile.role === "professeur") {
    const { data: assignments } = await svc.from("teaching_assignments")
      .select("class_id")
      .eq("teacher_id", viewer.id);
    
    if (assignments) {
      return assignments.some(a => a.class_id === timetable.class_id);
    }
  }

  // Students can view if they're in the class
  if (viewerProfile.role === "eleve") {
    const { data: student } = await svc.from("students")
      .select("class_id")
      .eq("id", viewer.id)
      .single();

    if (student && student.class_id === timetable.class_id) {
      return true;
    }
  }

  // Parents can view if their child is in the class
  if (viewerProfile.role === "parent") {
    const { data: parent } = await svc.from("parents")
      .select("child_class_id")
      .eq("id", viewer.id)
      .single();

    if (parent && parent.child_class_id === timetable.class_id) {
      return true;
    }
  }

  return false;
}

module.exports = { checkTimetableViewer };
    res.setHeader("Content-Disposition", `attachment; filename="emploi-du-temps-${timetable.title}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (e) {
    console.error("[timetables-export-pdf]", e);
    return serverError(res);
  }
});
        end_time: slot.end_time,
        subject: slot.subject,
        teacher_id: slot.teacher_id || null,
        class_room_id: slot.class_room_id || null,
        notes: slot.notes || null,
      }))
    );

    if (error) return serverError(res, error.message);

    return ok(res, { slots: data }, 201);
  } catch (e) {
    console.error("[timetables-slots-add]", e);
    return serverError(res);
  }
});
  }
});

    const { data, error } = await svc.from("timetables")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) return serverError(res, error.message);

    return ok(res, { timetable: data[0] });
  } catch (e) {
    console.error("[timetables-update]", e);
    return serverError(res);
  }
});