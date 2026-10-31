/** Contrôle de l'emploi du temps : création, modification, consultation des créneaux horaires.
 * Réservé au directeur et au personnel autorisé (proviseur, secrétaire).
 * Toutes les requêtes sont filtrées par school_id (isolement établissements).
 */

import { audit, requireDirecteur, requireAdminAgent, serviceClient, schoolIsWritable } from "../lib/auth.js";
import { badRequest, forbidden, ok, route, serverError } from "../lib/http.js";

export default route(async (req, res) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return ok(res, { error: "Méthode non autorisée." }, 405);
  }
  const svc = serviceClient();
  try {
    // Vérifier que l'utilisateur a une école associée
    const user = await getAuthenticatedUser(svc, req);
    if (!user) return unauthorized(res);

    const schoolId = user.schoolId;
    if (!schoolId) {
      return ok(res, { error: "Aucune école associée à ce compte." }, 403);
    }

    // Vérifier l'écriture selon le rôle
    const isDirector = user.role === "directeur";
    const isAdminAuthorized = await checkAdminAuthorization(svc, user.id, schoolId);

    if (req.method === "GET") {
      return await handleGetSchedules(svc, req, res, schoolId, isDirector, isAdminAuthorized);
    } else {
      if (!isDirector && !isAdminAuthorized) {
        return forbidden(res, "Seule la direction peut modifier l'emploi du temps.");
      }
      return await handleModifySchedules(svc, req, res, schoolId, isDirector, isAdminAuthorized);
    }
  } catch (e) {
    console.error("[schedules]", e);
    return serverError(res);
  }
});

/** Récupère les emplois du temps selon les permissions */
async function handleGetSchedules(svc, req, res, schoolId, isDirector, isAdminAuthorized) {
  const { classId, day, subjectId, teacherId } = req.query;

  let query = svc.from("schedules").select(`
    id,
    class_id,
    subject_id,
    teacher_id,
    day_of_week,
    start_time,
    end_time,
    room,
    created_at,
    updated_at,
    class_rooms:name,
    subjects:name,
    teachers:first_name, last_name
  ).eq("school_id", schoolId);

  if (classId) {
    query = query.eq("class_id", classId);
  }

  if (day !== undefined) {
    // day est un nombre 0-5 (0=Lundi, ..., 5=Samedi)
    query = query.eq("day_of_week", parseInt(day));
  }

  if (subjectId) {
    query = query.eq("subject_id", subjectId);
  }

  if (teacherId) {
    query = query.eq("teacher_id", teacherId);
  }

  const { data, error } = await query.order("day_of_week").order("start_time");

  if (error) throw error;

  // Transformation en format lisible
  const daysMap = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

  const schedules = (data || []).map(s => ({
    id: s.id,
    class: s.class_rooms?.name || null,
    subject: s.subjects?.name || null,
    teacher: s.teachers ? `${s.teachers.first_name} ${s.teachers.last_name}` : null,
    day: daysMap[s.day_of_week] || s.day_of_week,
    startTime: s.start_time,
    endTime: s.end_time,
    room: s.room,
    createdAt: s.created_at,
  }));

  return ok(res, { schedules });
}

/** Vérifie si l'utilisateur a les droits admin sur l'école */
async function checkAdminAuthorization(svc, userId, schoolId) {
  try {
    const { data: agent } = await svc
      .from("admin_agents")
      .select("role")
      .eq("auth_user_id", userId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (!agent) return false;

    // Le proviseur et le secrétaire peuvent modifier si autorisés par le directeur
    const authorizedRoles = ["proviseur", "secretaire", "directeur"];
    return authorizedRoles.includes(agent.role);
  } catch {
    return false;
  }
}