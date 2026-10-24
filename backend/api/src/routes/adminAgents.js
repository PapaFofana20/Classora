/**
 * Gestion des agents administratifs Classora.
 * Toutes les opérations sont réservées au superadmin (liste, création,
 * modification de rôle, désactivation). L'identité et le rôle viennent du
 * profil admin_agents, jamais du client.
 */
import { audit, generateAdminMatricule, getAuthenticatedUser, getCallerAdminAgent, requireAdminRole, serviceClient } from "../lib/authAdmin.js";
import { badRequest, forbidden, ok, route, serverError, RATE_LIMIT_RE } from "../lib/http.js";
import { enforceRateLimit } from "../lib/rateLimit.js";
import { expectObject, requireEmail, requireSnPhone, requireString, ValidationError } from "../lib/validate.js";

const ADMIN_ROLES = Object.freeze(["superadmin", "admin", "agent_suivi"]);

export default route(async (req, res) => {
  const svc = serviceClient();
  try {
    // Résout l'appelant et son rôle admin.
    const admin = await requireAdminRole(svc, req, res);
    if (!admin) return;
    const { caller } = admin;

    if (req.method === "GET") {
      // Liste des agents (tous, ou filtrés par rôle/status).
      await enforceRateLimit(svc, `admin-agents-list:${caller.id}`, 30, 300);

      const { data: agents, error } = await svc
        .from("admin_agents")
        .select("id, matricule, role, status, first_name, last_name, email, phone, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) throw new Error("Impossible de charger les agents.");

      return ok(res, {
        agents: agents.map((a) => ({
          id: a.id,
          matricule: a.matricule,
          role: a.role,
          status: a.status,
          firstName: a.first_name,
          lastName: a.last_name,
          email: a.email,
          phone: a.phone,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        })),
      });
    }

    if (req.method === "POST") {
      // Création d'un nouvel agent (superadmin uniquement).
      if (caller.role !== "superadmin") {
        return forbidden(res, "Seul le superadministrateur peut créer un agent.");
      }
      await enforceRateLimit(svc, `admin-agents-create:${caller.id}`, 10, 300);

      const body = expectObject(req.body);
      const role = requireString(body, "role", "Le rôle", { max: 20 });
      if (!ADMIN_ROLES.includes(role)) {
        return badRequest(res, "Rôle invalide.");
      }
      const firstName = requireString(body, "firstName", "Le prénom", { min: 1, max: 60 });
      const lastName = requireString(body, "lastName", "Le nom", { min: 1, max: 60 });
      const email = requireEmail(body);
      const phone = optionalPhone(body);
      const tempPassword = optionalTempPassword(body);

      // Génère la matricule côté serveur.
      const { data: matriculeData, error: matriculeError } = await svc.rpc("generate_admin_matricule");
      if (matriculeError || !matriculeData) {
        throw new Error("Impossible de générer la matricule administrative.");
      }
      const matricule = matriculeData;

      // Crée le compte Auth via service_role.
      const { data: created, error: createError } = await svc.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        app_metadata: { role, school_id: null },
      });
      if (createError || !created?.user) {
        const duplicate = /already|duplicate|registered/i.test(createError?.message ?? "");
        return badRequest(
          res,
          duplicate ? "Un compte existe déjà avec cet e-mail." : "Impossible de créer le compte administrateur. Réessayez.",
        );
      }

      try {
        // Crée le profil agent.
        const { error: profileError } = await svc
          .from("admin_agents")
          .insert({
            auth_user_id: created.user.id,
            matricule,
            role,
            status: "ACTIF",
            first_name: firstName,
            last_name: lastName,
            email,
            phone: phone ?? "",
          });
        if (profileError) throw new Error(profileError.message);

        await audit(svc, {
          schoolId: null,
          actorId: caller.id,
          actorRole: caller.role,
          action: "admin_agent_created",
          entity: "admin_agents",
          entityId: created.user.id,
          payload: { matricule, role, email },
        });

        return ok(res, {
          userId: created.user.id,
          matricule,
          email,
          tempPassword,
          firstName,
          lastName,
          role,
        });
      } catch (sqlError) {
        // Nettoyage : supprime le compte Auth si le profil échoue.
        await svc.auth.admin.deleteUser(created.user.id);
        const message = sqlError instanceof Error ? sqlError.message : undefined;
        if (message && /un compte existe déjà|unique|duplicate/i.test(message)) return badRequest(res, message);
        console.error("[admin-agents] profile insert", sqlError);
        return serverError(res);
      }
    }

    if (req.method === "PATCH") {
      // Modification d'un agent (rôle, statut, informations).
      const body = expectObject(req.body);
      const agentId = requireString(body, "agentId", "L'identifiant de l'agent", { max: 64 });

      const { data: target, error: targetError } = await svc
        .from("admin_agents")
        .select("id, role, status, auth_user_id")
        .eq("id", agentId)
        .maybeSingle();
      if (targetError || !target) {
        return notFound(res, "Agent introuvable.");
      }

      // Seul le superadmin peut modifier un autre agent ; un admin ne peut
      // pas modifier un superadmin ni changer le rôle d'un agent à superadmin.
      if (caller.id !== target.auth_user_id && caller.role !== "superadmin") {
        return forbidden(res, "Seul le superadministrateur peut modifier un autre agent.");
      }
      if (caller.role !== "superadmin" && target.role === "superadmin") {
        return forbidden(res, "Seul le superadministrateur peut modifier un superadministrateur.");
      }

      const patch = {};
      if (body.role !== undefined) {
        const newRole = requireString(body, "role", "Le rôle", { max: 20 });
        if (!ADMIN_ROLES.includes(newRole)) return badRequest(res, "Rôle invalide.");
        if (caller.role !== "superadmin") return forbidden(res, "Seul le superadministrateur peut modifier un rôle.");
        patch.role = newRole;
      }
      if (body.status !== undefined) {
        const newStatus = requireString(body, "status", "Le statut", { max: 20 });
        if (!["ACTIF", "EN_ATTENTE", "DESACTIVE"].includes(newStatus)) return badRequest(res, "Statut invalide.");
        patch.status = newStatus;
      }
      if (body.firstName !== undefined) patch.first_name = requireString(body, "firstName", "Le prénom", { min: 1, max: 60 });
      if (body.lastName !== undefined) patch.last_name = requireString(body, "lastName", "Le nom", { min: 1, max: 60 });
      if (body.phone !== undefined) patch.phone = optionalSnPhoneField(body);
      if (body.email !== undefined) {
        patch.email = requireEmail(body, "email");
      }

      if (Object.keys(patch).length === 0) {
        return badRequest(res, "Aucune modification fournie.");
      }

      const { error: updateError } = await svc.from("admin_agents").update(patch).eq("id", agentId);
      if (updateError) {
        if (/unique|duplicate/i.test(updateError.message)) return badRequest(res, "Cet e-mail ou matricule est déjà utilisé.");
        return serverError(res);
      }

      await audit(svc, {
        schoolId: null,
        actorId: caller.id,
        actorRole: caller.role,
        action: "admin_agent_updated",
        entity: "admin_agents",
        entityId: agentId,
        payload: patch,
      });

      return ok(res, { message: "Agent mis à jour." });
    }

    return ok(res, { error: "Méthode non autorisée." }, 405);
  } catch (e) {
    if (e instanceof Error && RATE_LIMIT_RE.test(e.message)) return ok(res, { error: e.message }, 429);
    console.error("[admin-agents]", e);
    return serverError(res);
  }
});

function optionalPhone(body) {
  const raw = body["phone"];
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") throw new ValidationError("Le téléphone est invalide.");
  if (!/^(\+221)?\s?7[0678]\s?\d{3}\s?\d{2}\s?\d{2}$/.test(raw.trim())) {
    throw new ValidationError("Le téléphone est invalide.");
  }
  return raw.trim();
}

function optionalTempPassword(body) {
  const raw = body["tempPassword"];
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") throw new ValidationError("Le mot de passe temporaire est invalide.");
  return raw.trim();
}

function optionalSnPhoneField(body) {
  const raw = body["phone"];
  if (raw === undefined || raw === null || raw === "") return "";
  if (typeof raw !== "string") throw new ValidationError("Le téléphone est invalide.");
  if (!/^(\+221)?\s?7[0678]\s?\d{3}\s?\d{2}\s?\d{2}$/.test(raw.trim())) {
    throw new ValidationError("Le téléphone est invalide.");
  }
  return raw.trim();
}