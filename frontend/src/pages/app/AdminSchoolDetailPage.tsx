import { useState } from "react";
import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { AsyncView } from "@/components/ui/AsyncView";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/Button";
import { useAsync } from "@/hooks/useAsync";
import { listAdminSchools, updateAdminSchool, setAdminSchoolStatus } from "@/services/admin";
import type { AdminSchool } from "@/types";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Modal } from "@/components/ui/Modal";

export default function AdminSchoolDetailPage() {
  const { schoolId } = useParams();
  const { agent } = useAdminAuth();
  const isSuperAdmin = agent?.role === "superadmin";

  if (!schoolId) return <div>École introuvable.</div>;

  const state = useAsync(() => listAdminSchools({ page: 1, pageSize: 100, sortBy: "name", sortDir: "asc" }), []);

  return (
    <>
      <AsyncView state={state}>
        {(s) => {
          const school = s.schools.find((x) => x.id === schoolId);
          if (!school) return <div>École introuvable.</div>;
          return <Content school={school} isSuperAdmin={isSuperAdmin} />;
        }}
      </AsyncView>
    </>
  );
}

function Content({ school, isSuperAdmin }: { school: AdminSchool; isSuperAdmin: boolean }) {
  const [editing, setEditing] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<"ACTIF" | "SUSPENDUE">("ACTIF");
  const [form, setForm] = useState({
    name: school.name,
    city: school.city,
    address: school.address,
    phone: school.phone,
    email: school.email,
    cycles: school.cycles,
    registrationOpen: school.registrationOpen,
    autoApproveStudents: school.autoApproveStudents,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await updateAdminSchool({
        schoolId: school.id,
        name: form.name.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        cycles: form.cycles,
        registrationOpen: form.registrationOpen,
        autoApproveStudents: form.autoApproveStudents,
      });
      setStatusMsg({ type: "success", text: "Établissement mis à jour avec succès." });
      setEditing(false);
    } catch (e: any) {
      setError(e.message || "Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (newStatus: "ACTIF" | "SUSPENDUE") => {
    setPendingStatus(newStatus);
    setStatusModal(true);
  };

  const confirmStatusChange = async () => {
    try {
      await setAdminSchoolStatus({ schoolId: school.id, status: pendingStatus });
      setStatusMsg({ type: "success", text: `Établissement ${pendingStatus === "ACTIF" ? "activé" : "suspendu"} avec succès.` });
      setStatusModal(false);
      window.location.reload();
    } catch (e: any) {
      setError(e.message || "Erreur lors du changement de statut.");
    }
  };

  const cycleLabels: Record<string, string> = { elementaire: "Élémentaire", moyen: "Moyen", secondaire: "Secondaire" };

  return (
    <div className="space-y-4">
      <PageHeader
        title={school.name}
        subtitle={`Matricule : ${school.matricule} · ${school.city}`}
        actions={
          <>
            <LinkButton to="/admin/ecoles" variant="ghost" size="sm" icon="arrow_back">
              Retour à la liste
            </LinkButton>
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                  Annuler
                </Button>
                <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
                  Enregistrer
                </Button>
              </>
            ) : (
              <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
                Modifier les infos
              </Button>
            )}
            {isSuperAdmin && (
              <Button
                variant={school.registrationOpen ? "danger" : "primary"}
                size="sm"
                onClick={() => handleStatusChange(school.registrationOpen ? "SUSPENDUE" : "ACTIF")}
              >
                {school.registrationOpen ? "Suspendre" : "Activer"}
              </Button>
            )}
          </>
        }
      />

      {statusMsg && (
        <div className={`rounded-xl p-3 ${statusMsg.type === "success" ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}>
          <Icon name={statusMsg.type === "success" ? "check_circle" : "error"} fill className={`mr-2 ${statusMsg.type === "success" ? "text-emerald-600" : "text-red-600"}`} />
          <span className="text-sm">{statusMsg.text}</span>
        </div>
      )}

      {editing && (
        <Card>
          <CardHeader title="Modifier les informations administratives" />
          <form onSubmit={handleSave} className="p-4 space-y-4">
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Nom de l'établissement" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Ville" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              <Input label="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <Input label="Téléphone" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="E-mail" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-ink">Cycles</label>
                <div className="flex gap-2">
                  {["elementaire", "moyen", "secondaire"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        const idx = form.cycles.indexOf(c);
                        const next = idx >= 0 ? form.cycles.filter((x) => x !== c) : [...form.cycles, c];
                        setForm({ ...form, cycles: next });
                      }}
                      className={`px-3 py-2 rounded-xl text-sm border transition ${form.cycles.includes(c) ? "bg-forest text-white border-forest" : "bg-white text-neutral-600 border-neutral-300 hover:border-forest"}`}
                    >
                      {cycleLabels[c]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-ink">Options</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.registrationOpen} onChange={(e) => setForm({ ...form, registrationOpen: e.target.checked })} /> Inscriptions ouvertes
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.autoApproveStudents} onChange={(e) => setForm({ ...form, autoApproveStudents: e.target.checked })} /> Approbation automatique des élèves
                </label>
              </div>
            </div>
          </form>
        </Card>
      )}

      {!editing && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader title="Informations générales" />
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-neutral-400">Nom</span>
                <span className="text-sm font-medium">{school.name}</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-neutral-400">Matricule</span>
                <span className="text-sm font-mono font-medium">{school.matricule}</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-neutral-400">Ville</span>
                <span className="text-sm">{school.city}</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-neutral-400">Adresse</span>
                <span className="text-sm">{school.address || "—"}</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-neutral-400">Téléphone</span>
                <span className="text-sm">{school.phone}</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-neutral-400">E-mail</span>
                <span className="text-sm">{school.email}</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-neutral-400">Cycles</span>
                <span className="text-sm">{school.cycles.map((c) => cycleLabels[c]).join(" · ") || "—"}</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-neutral-400">Créé le</span>
                <span className="text-sm text-neutral-500">{school.createdAt}</span>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Statut et options" />
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-neutral-400">Statut</span>
                <Badge tone={school.registrationOpen ? "success" : "danger"}>
                  {school.registrationOpen ? "Actif" : "Suspendu"}
                </Badge>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-neutral-400">Inscriptions</span>
                <Badge tone={school.registrationOpen ? "success" : "neutral"}>
                  {school.registrationOpen ? "Ouvertes" : "Fermées"}
                </Badge>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-neutral-400">Approbation auto.</span>
                <Badge tone={school.autoApproveStudents ? "success" : "neutral"}>
                  {school.autoApproveStudents ? "Activée" : "Désactivée"}
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Changer le statut de l'établissement" size="sm">
        <p className="mb-4">Voulez-vous vraiment {pendingStatus === "ACTIF" ? "activer" : "suspendre"} l'établissement <strong>{school.name}</strong> ?</p>
        <div className="flex justify-end gap-3" slot="footer">
          <Button variant="outline" onClick={() => setStatusModal(false)}>
            Annuler
          </Button>
          <Button variant="danger" onClick={confirmStatusChange}>
            {pendingStatus === "ACTIF" ? "Activer" : "Suspendre"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}