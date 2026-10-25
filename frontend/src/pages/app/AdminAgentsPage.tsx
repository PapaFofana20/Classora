import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { AsyncView } from "@/components/ui/AsyncView";
import { Card, CardHeader } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Icon } from "@/components/ui/Icon";
import { useAsync } from "@/hooks/useAsync";
import {
  listAdminAgents,
  createAdminAgent,
  type AdminAgent,
  type AdminAgentRole,
  type CreateAdminAgentInput,
} from "@/services/admin";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Modal } from "@/components/ui/Modal";

export default function AdminAgentsPage() {
  const { isSuperAdmin } = useAdminAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateAdminAgentInput>({
    role: "agent_suivi",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const state = useAsync(() => listAdminAgents(), []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      const created = await createAdminAgent(form);
      setStatusMsg({
        type: "success",
        text: `Agent créé — matricule ${created.matricule}. Il peut se connecter sur /admin/connexion avec cette matricule ou ${created.email}, et son mot de passe.`,
      });
      setShowCreate(false);
      setForm({ role: "agent_suivi", firstName: "", lastName: "", email: "", phone: "", password: "" });
      state.reload();
    } catch (e: any) {
      setCreateError(e.message || "Erreur lors de la création de l'agent.");
    } finally {
      setCreating(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardHeader title="Accès réservé" />
        <p className="text-neutral-500 text-sm">Seul le superadministrateur peut gérer les agents.</p>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Gestion des agents Classora"
        subtitle="Profils, matricules, rôles et statuts des agents administratifs"
        actions={
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            Nouvel agent
          </Button>
        }
      />

      {statusMsg && (
        <div className={`rounded-xl p-3 ${statusMsg.type === "success" ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}>
          <Icon name={statusMsg.type === "success" ? "check_circle" : "error"} fill className={`mr-2 ${statusMsg.type === "success" ? "text-emerald-600" : "text-red-600"}`} />
          <span className="text-sm">{statusMsg.text}</span>
        </div>
      )}

      <AsyncView state={state}>
        {(s: { agents: AdminAgent[] }) => <Content agents={s.agents} />}
      </AsyncView>

      <Modal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setCreateError("");
        }}
        title="Nouvel agent administratif"
        size="md"
      >
        <form onSubmit={handleCreate} className="p-4 space-y-4">
          {createError && <p className="text-xs text-danger">{createError}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Rôle"
              required
              value={form.role}
              options={[
                { value: "superadmin", label: "Superadministrateur" },
                { value: "admin", label: "Administrateur" },
                { value: "agent_suivi", label: "Agent de suivi" },
              ]}
              onChange={(e) => setForm({ ...form, role: e.target.value as AdminAgentRole })}
            />
            <Input label="Prénom" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <Input label="Nom" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            <Input label="E-mail" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input
              label="Mot de passe"
              type="password"
              required
              autoComplete="new-password"
              className="sm:col-span-2"
              hint="Mot de passe fixe de l'agent : il servira à chaque connexion. 8 caractères minimum, avec majuscule, minuscule et chiffre."
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <p className="text-xs text-neutral-500">
            Un matricule au format <code className="text-forest">CLA-ADM-000001</code> sera généré automatiquement.
          </p>
          <div className="flex justify-end gap-3" slot="footer">
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" loading={creating}>
              Créer l'agent
            </Button>
          </div>
        </form>
      </Modal>

    </>
  );
}

function Content({ agents }: { agents: AdminAgent[] }) {
  const roleLabels: Record<AdminAgentRole, string> = {
    superadmin: "Superadmin",
    admin: "Administrateur",
    agent_suivi: "Agent de suivi",
  };
  const roleTones: Record<AdminAgentRole, "dark" | "lime" | "neutral"> = {
    superadmin: "dark",
    admin: "lime",
    agent_suivi: "neutral",
  };

  if (agents.length === 0) {
    return (
      <Card>
        <CardHeader title="Aucun agent" />
        <p className="text-neutral-500 text-sm">Aucun agent administratif n'a été créé.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Liste des agents" />
        <div className="overflow-x-auto">
          <Table
            columns={[
              {
                key: "name",
                header: "Agent",
                render: (r: AdminAgent) => (
                  <div className="min-w-0">
                    <div className="font-medium">{r.firstName} {r.lastName}</div>
                    <div className="text-xs text-neutral-500">{r.email}</div>
                  </div>
                ),
              },
              {
                key: "matricule",
                header: "Matricule",
                render: (r: AdminAgent) => <span className="text-xs text-neutral-500 tabular-nums font-mono">{r.matricule}</span>,
              },
              {
                key: "role",
                header: "Rôle",
                render: (r: AdminAgent) => <Badge tone={roleTones[r.role]}>{roleLabels[r.role]}</Badge>,
              },
              {
                key: "status",
                header: "Statut",
                render: (r: AdminAgent) =>
                  <Badge tone={r.status === "ACTIF" ? "success" : "danger"}>
                    {r.status === "ACTIF" ? "Actif" : r.status === "DESACTIVE" ? "Désactivé" : "En attente"}
                  </Badge>,
              },
              {
                key: "created",
                header: "Créé le",
                render: (r: AdminAgent) => <span className="text-xs text-neutral-500">{r.createdAt.slice(0, 10)}</span>,
              },
            ]}
            rows={agents}
            rowKey={(r: AdminAgent) => r.id}
            caption="Agents administratifs Classora"
          />
        </div>
      </Card>
    </div>
  );
}