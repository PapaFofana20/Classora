/**
 * Statistiques transversales : calculées côté serveur, jamais de téléchargement
 * de toutes les données dans le navigateur. Réservée aux agents admin/superadmin.
 */
import { requireAdminRole, serviceClient } from "../lib/authAdmin.js";
import { ok, route, serverError, RATE_LIMIT_RE } from "../lib/http.js";
import { enforceRateLimit } from "../lib/rateLimit.js";

export default route(async (req, res) => {
  if (req.method !== "GET") return ok(res, { error: "Méthode non autorisée." }, 405);
  const svc = serviceClient();
  try {
    const admin = await requireAdminRole(svc, req, res);
    if (!admin) return;
    const { caller } = admin;

    await enforceRateLimit(svc, `admin-stats:${caller.id}`, 30, 300);

    // Nombre total d'écoles.
    const { count: totalSchools } = await svc.from("schools").select("*", { count: "exact", head: true });

    // Écoles actives (abonnement valide).
    const today = new Date().toISOString().slice(0, 10);
    const { count: activeSchools } = await svc
      .from("subscriptions")
      .select("school_id", { count: "exact", head: true })
      .gte("ends_at", today);

    // Nombre total d'élèves (toutes écoles confondues).
    const { count: totalStudents } = await svc.from("students").select("*", { count: "exact", head: true });

    // Nombre total de classes.
    const { count: totalClasses } = await svc.from("class_rooms").select("*", { count: "exact", head: true });

    // Nombre total de profils par rôle (agents scolaires).
    const { count: totalDirectors } = await svc.from("profiles").select("*", { count: "exact", head: true }).eq("role", "directeur");
    const { count: totalTeachers } = await svc.from("profiles").select("*", { count: "exact", head: true }).in("role", ["professeur", "instituteur"]);
    const { count: totalParents } = await svc.from("profiles").select("*", { count: "exact", head: true }).eq("role", "parent");

    // Statistiques par établissement (top 10 par effectif).
    const { data: schoolStats, error: statsError } = await svc.rpc("admin_school_stats");
    if (statsError) throw new Error("Impossible de charger les statistiques par établissement.");

    // Activités récentes (audit_log des actions administratives).
    const { data: recentActivity, error: activityError } = await svc
      .from("audit_log")
      .select("action, entity, created_at, school_id, actor_role")
      .order("created_at", { ascending: false })
      .limit(20);

    if (activityError) throw new Error("Impossible de charger l'activité récente.");

    return ok(res, {
      generatedAt: new Date().toISOString(),
      schools: {
        total: totalSchools ?? 0,
        active: activeSchools ?? 0,
        suspended: (totalSchools ?? 0) - (activeSchools ?? 0),
      },
      people: {
        totalStudents: totalStudents ?? 0,
        totalClasses: totalClasses ?? 0,
        totalDirectors: totalDirectors ?? 0,
        totalTeachers: totalTeachers ?? 0,
        totalParents: totalParents ?? 0,
      },
      bySchool: (schoolStats ?? []).map((s) => ({
        schoolId: s.school_id,
        schoolName: s.school_name,
        matricule: s.matricule ?? "",
        studentCount: Number(s.student_count ?? 0),
        classCount: Number(s.class_count ?? 0),
        teacherCount: Number(s.teacher_count ?? 0),
        status: s.subscription_status ?? "AUCUN",
      })),
      recentActivity: (recentActivity ?? []).map((a) => ({
        action: a.action,
        entity: a.entity,
        createdAt: a.created_at,
        schoolId: a.school_id,
        actorRole: a.actor_role,
      })),
    });
  } catch (e) {
    if (e instanceof Error && RATE_LIMIT_RE.test(e.message)) return ok(res, { error: e.message }, 429);
    console.error("[admin-stats]", e);
    return serverError(res);
  }
});