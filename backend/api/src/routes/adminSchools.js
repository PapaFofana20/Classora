/**
 * Gestion transversale des établissements : l'agent administratif peut
 * consulter toutes les écoles, modifier leurs informations et gérer leurs
 * statuts (activation/suspension). L'identité et les permissions viennent
 * du profil admin_agents, jamais du client.
 */
import { audit, getAuthenticatedUser, getCallerAdminAgent, requireAdminRole, serviceClient } from "../lib/authAdmin.js";
import { badRequest, forbidden, ok, route, serverError, RATE_LIMIT_RE } from "../lib/http.js";
import { enforceRateLimit } from "../lib/rateLimit.js";
import { expectObject, requireEmail, requireSnPhone, requireString, ValidationError } from "../lib/validate.js";

export default route(async (req, res) => {
  const svc = serviceClient();
  try {
    const admin = await requireAdminRole(svc, req, res);
    if (!admin) return;
    const { caller } = admin;

    if (req.method === "GET") {
      // Liste des écoles avec recherche, filtres, tri, pagination.
      await enforceRateLimit(svc, `admin-schools-list:${caller.id}`, 30, 300);

      const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? "20", 10)));
      const search = (req.query.search ?? "").toString().trim();
      const status = req.query.status ? String(req.query.status) : null; // ACTIF, SUSPENDUE, TOUTES
      const sortBy = req.query.sortBy ?? "created_at";
      const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";

      let query = svc
        .from("schools")
        .select("id, name, matricule, city, address, phone, email, logo_url, cycles, registration_open, auto_approve_students, created_at", { count: "exact" });

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      // Filtre par statut : on déduit du statut d'abonnement.
      if (status === "ACTIF") {
        query = query.in(
          "id",
          svc.from("subscriptions").select("school_id").gte("ends_at", new Date().toISOString().slice(0, 10)),
        );
      } else if (status === "SUSPENDUE") {
        query = query.not(
          "id",
          svc.from("subscriptions").select("school_id").gte("ends_at", new Date().toISOString().slice(0, 10)),
        );
      }

      const { data: schools, error, count } = await query
        .order(sortBy, { ascending: sortDir === "asc" })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) throw new Error("Impossible de charger les établissements.");

      return ok(res, {
        schools: (schools ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          matricule: s.matricule ?? "",
          city: s.city,
          address: s.address,
          phone: s.phone,
          email: s.email,
          logoUrl: s.logo_url,
          cycles: s.cycles ?? [],
          registrationOpen: s.registration_open,
          autoApproveStudents: s.auto_approve_students,
          createdAt: s.created_at,
        })),
        total: count ?? 0,
        page,
        pageSize,
      });
    }

    if (req.method === "PATCH") {
      // Modification d'une école (informations administratives).
      const body = expectObject(req.body);
      const schoolId = requireString(body, "schoolId", "L'identifiant de l'établissement", { max: 64 });

      const patch = {};
      if (body.name !== undefined) patch.name = requireString(body, "name", "Le nom de l'école", { min: 2, max: 120 });
      if (body.city !== undefined) patch.city = requireString(body, "city", "La ville", { min: 1, max: 80 });
      if (body.address !== undefined) patch.address = requireString(body, "address", "L'adresse", { max: 200 });
      if (body.phone !== undefined) patch.phone = requireSnPhone(body, "phone", "Le téléphone");
      if (body.email !== undefined) patch.email = requireEmailField(body);
      if (body.cycles !== undefined) {
        const cycles = requireCyclesField(body);
        patch.cycles = cycles;
      }
      if (body.registrationOpen !== undefined) patch.registration_open = body.registrationOpen === true;
      if (body.autoApproveStudents !== undefined) patch.auto_approve_students = body.autoApproveStudents === true;

      if (Object.keys(patch).length === 0) {
        return badRequest(res, "Aucune modification fournie.");
      }

      const { data: updated, error: updateError } = await svc
        .from("schools")
        .update(patch)
        .eq("id", schoolId)
        .select("id, name, matricule")
        .single();
      if (updateError) {
        if (/duplicate|unique/i.test(updateError.message)) return badRequest(res, "Un établissement existe déjà avec ces informations.");
        return serverError(res);
      }

      await audit(svc, {
        schoolId,
        actorId: caller.id,
        actorRole: caller.role,
        action: "admin_school_updated",
        entity: "schools",
        entityId: schoolId,
        payload: patch,
      });

      return ok(res, {
        id: updated.id,
        name: updated.name,
        matricule: updated.matricule,
      });
    }

    if (req.method === "POST" && req.body && req.body.action === "setStatus") {
      // Activation / suspension d'une école (superadmin uniquement).
      if (caller.role !== "superadmin") {
        return forbidden(res, "Seul le superadministrateur peut modifier le statut d'un établissement.");
      }

      const body = expectObject(req.body);
      const schoolId = requireString(body, "schoolId", "L'identifiant de l'établissement", { max: 64 });
      const newStatus = requireString(body, "status", "Le statut", { max: 20 });
      if (!["ACTIF", "SUSPENDUE"].includes(newStatus)) {
        return badRequest(res, "Statut invalide.");
      }

      // Met à jour le statut via registration_open (suspendue = inscriptions closes + école désactivée).
      const { error: updateError } = await svc
        .from("schools")
        .update({ registration_open: newStatus === "ACTIF" })
        .eq("id", schoolId);
      if (updateError) return serverError(res);

      await audit(svc, {
        schoolId,
        actorId: caller.id,
        actorRole: caller.role,
        action: "admin_school_status_changed",
        entity: "schools",
        entityId: schoolId,
        payload: { newStatus },
      });

      return ok(res, { message: `Établissement ${newStatus === "ACTIF" ? "activé" : "suspendu"} avec succès.` });
    }

    return ok(res, { error: "Méthode non autorisée." }, 405);
  } catch (e) {
    if (e instanceof Error && RATE_LIMIT_RE.test(e.message)) return ok(res, { error: e.message }, 429);
    console.error("[admin-schools]", e);
    return serverError(res);
  }
});

function requireEmailField(body) {
  const raw = requireString(body, "email", "L'e-mail", { max: 120, trim: true });
  const email = raw.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new ValidationError("L'e-mail est invalide.");
  }
  return email;
}

function requireCyclesField(body) {
  const raw = body["cycles"];
  const allowed = new Set(["elementaire", "moyen", "secondaire"]);
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ValidationError("Sélectionnez au moins un cycle.");
  }
  const cycles = raw.filter((c) => typeof c === "string" && allowed.has(c));
  if (cycles.length === 0 || cycles.length !== raw.length) {
    throw new ValidationError("Sélection de cycles invalide.");
  }
  return Array.from(new Set(cycles));
}