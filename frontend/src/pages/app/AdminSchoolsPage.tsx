import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { AsyncView } from "@/components/ui/AsyncView";
import { Card, CardHeader } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useAsync } from "@/hooks/useAsync";
import {
  listAdminSchools,
  setAdminSchoolStatus,
  deleteAdminSchool,
  type ListSchoolsParams,
  type ListSchoolsResult,
} from "@/services/admin";
import type { AdminSchool } from "@/types";
import { formatDate } from "@/utils/format";
import { useAdminAuth } from "@/context/AdminAuthContext";

export default function AdminSchoolsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState((searchParams.get("status") ?? "all") as "all" | "ACTIF" | "SUSPENDUE");
  const [page, setPageState] = useState(Math.max(1, parseInt(searchParams.get("page") ?? "1", 10)));
  const [pageSize, setPageSizeState] = useState(Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") ?? "20", 10))));

  const params: ListSchoolsParams = {
    page,
    pageSize,
    search: search || undefined,
    status: status === "all" ? null : status,
  };

  const state = useAsync(() => listAdminSchools(params), [page, pageSize, search, status]);

  const updateQuery = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === undefined) next.delete(k);
      else next.set(k, v);
    });
    setSearchParams(next);
  };

  return (
    <>
      <PageHeader
        title="Gestion des établissements"
        subtitle="Toutes les écoles enregistrées sur Classora"
        actions={
          <>
            <Input
              label="Rechercher"
              placeholder="Nom de l'établissement…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                updateQuery({ search: e.target.value, page: "1" });
              }}
              className="w-64"
              icon="search"
            />
            <Select
              label="Statut"
              value={status}
              options={[
                { value: "all", label: "Tous" },
                { value: "ACTIF", label: "Actifs" },
                { value: "SUSPENDUE", label: "Suspendues" },
              ]}
              onChange={(e) => {
                const v = e.target.value as "all" | "ACTIF" | "SUSPENDUE";
                setStatus(v);
                updateQuery({ status: v === "all" ? null : v, page: "1" });
              }}
              compact
            />
          </>
        }
      />
      <AsyncView state={state}>
        {(s) => <Content s={s} updateQuery={updateQuery} setPageState={setPageState} setPageSizeState={setPageSizeState} reload={state.reload} />}
      </AsyncView>
    </>
  );
}

function Content({
  s,
  updateQuery,
  setPageState,
  setPageSizeState,
  reload,
}: {
  s: ListSchoolsResult;
  updateQuery: (u: Record<string, string | null>) => void;
  setPageState: (p: number) => void;
  setPageSizeState: (p: number) => void;
  reload: () => void;
}) {
  void setPageSizeState;
  const { isSuperAdmin } = useAdminAuth();

  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminSchool | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminSchool | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const expectedConfirmation = (school: AdminSchool) => school.matricule || school.name;

  const toggleStatus = async () => {
    if (!statusTarget) return;
    const newStatus = statusTarget.registrationOpen ? "SUSPENDUE" : "ACTIF";
    setActionError("");
    setBusy(true);
    try {
      await setAdminSchoolStatus({ schoolId: statusTarget.id, status: newStatus });
      setStatusMsg({ type: "success", text: `Établissement ${newStatus === "ACTIF" ? "activé" : "suspendu"} avec succès.` });
      setStatusTarget(null);
      reload();
    } catch (e: any) {
      setActionError(e.message || "Erreur lors du changement de statut.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setActionError("");
    setBusy(true);
    try {
      await deleteAdminSchool({ schoolId: deleteTarget.id, confirmation: deleteConfirm });
      setStatusMsg({ type: "success", text: `Établissement ${deleteTarget.name} supprimé définitivement.` });
      setDeleteTarget(null);
      setDeleteConfirm("");
      reload();
    } catch (e: any) {
      setActionError(e.message || "Erreur lors de la suppression.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {statusMsg && (
        <div className={`rounded-xl p-3 ${statusMsg.type === "success" ? "border border-emerald-100 bg-emerald-50" : "border border-red-100 bg-red-50"}`}>
          <Icon
            name={statusMsg.type === "success" ? "check_circle" : "error"}
            fill
            className={`mr-2 ${statusMsg.type === "success" ? "text-emerald-600" : "text-red-600"}`}
          />
          <span className="text-sm">{statusMsg.text}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader title="Total établissements" />
          <p className="text-3xl font-extrabold text-forest">{s.total}</p>
        </Card>
        <Card>
          <CardHeader title="Cette page" />
          <p className="text-3xl font-extrabold text-forest">{s.schools.length}</p>
        </Card>
      </div>

      <div className="overflow-x-auto">
        <Table
          columns={[
            {
              key: "name",
              header: "Établissement",
              render: (r: AdminSchool) => (
                <div className="min-w-0">
                  <LinkButton to={`/admin/ecoles/${r.id}`} variant="ghost" size="sm" icon="visibility">
                    {r.name}
                  </LinkButton>
                  <div className="text-xs text-neutral-500">{formatDate(r.createdAt)}</div>
                </div>
              ),
            },
            { key: "matricule", header: "Matricule", render: (r: AdminSchool) => <span className="text-xs text-neutral-500 tabular-nums font-mono">{r.matricule}</span> },
            { key: "city", header: "Ville", render: (r: AdminSchool) => <span className="text-sm text-neutral-600">{r.city}</span> },
            {
              key: "status",
              header: "Statut",
              align: "center",
              render: (r: AdminSchool) => {
                // Le badge reflète l'état que les boutons modifient
                // (registration_open). L'ancien test « matricule && open »
                // affichait « Suspendu » à toute école sans matricule.
                return (
                  <Badge tone={r.registrationOpen ? "success" : "danger"}>
                    {r.registrationOpen ? "Actif" : "Suspendu"}
                  </Badge>
                );
              },
            },
            ...(isSuperAdmin
              ? [
                  {
                    key: "actions",
                    header: "Actions",
                    align: "center" as const,
                    render: (r: AdminSchool) => (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          title={r.registrationOpen ? "Suspendre cet établissement" : "Réactiver cet établissement"}
                          aria-label={r.registrationOpen ? `Suspendre ${r.name}` : `Réactiver ${r.name}`}
                          onClick={() => {
                            setActionError("");
                            setStatusTarget(r);
                          }}
                          className="grid size-9 place-items-center rounded-full text-neutral-500 transition hover:bg-mist hover:text-forest"
                        >
                          <Icon name={r.registrationOpen ? "pause" : "play_arrow"} className="text-[20px]" />
                        </button>
                        <button
                          type="button"
                          title="Supprimer définitivement cet établissement"
                          aria-label={`Supprimer définitivement ${r.name}`}
                          onClick={() => {
                            setActionError("");
                            setDeleteConfirm("");
                            setDeleteTarget(r);
                          }}
                          className="grid size-9 place-items-center rounded-full text-danger/70 transition hover:bg-red-50 hover:text-danger"
                        >
                          <Icon name="delete" className="text-[20px]" />
                        </button>
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
          rows={s.schools}
          rowKey={(r: AdminSchool) => r.id}
          caption="Liste des établissements scolaires"
          stagger
        />
      </div>

      <Pagination page={s.page} pageSize={s.pageSize} total={s.total} onChange={(p) => {
        setPageState(p);
        updateQuery({ page: String(p) });
      }} />

      {/* Suspension / réactivation */}
      <Modal
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        title={statusTarget?.registrationOpen ? "Suspendre l'établissement" : "Activer l'établissement"}
        size="sm"
      >
        <p className="mb-4">
          Voulez-vous vraiment {statusTarget?.registrationOpen ? "suspendre" : "réactiver"} l'établissement{" "}
          <strong>{statusTarget?.name}</strong> ?
          {statusTarget?.registrationOpen && " Une école suspendue n'inscrit plus de nouveaux élèves et ses données deviennent inaccessibles."}
        </p>
        {actionError && (
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-danger">
            <Icon name="error" className="text-[20px]" />
            {actionError}
          </p>
        )}
        <div className="flex justify-end gap-3" slot="footer">
          <Button variant="outline" onClick={() => setStatusTarget(null)} disabled={busy}>
            Annuler
          </Button>
          <Button variant={statusTarget?.registrationOpen ? "danger" : "primary"} onClick={toggleStatus} loading={busy}>
            {statusTarget?.registrationOpen ? "Suspendre" : "Activer"}
          </Button>
        </div>
      </Modal>

      {/* Suppression définitive (confirmation par matricule ou nom) */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Supprimer définitivement l'établissement" size="sm">
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-danger">
            <Icon name="warning" fill className="text-[20px]" />
            Cette action est irréversible.
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Seront définitivement supprimés : l'établissement <strong>{deleteTarget?.name}</strong>, ses élèves, classes,
            enseignants, parents, abonnements, messages, ainsi que tous les comptes de connexion associés.
          </p>
        </div>
        {actionError && (
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-danger">
            <Icon name="error" className="text-[20px]" />
            {actionError}
          </p>
        )}
        {deleteTarget?.matricule ? (
          <Input
            label="Tapez la matricule de l'établissement pour confirmer"
            hint={`Matricule attendue : ${deleteTarget.matricule}`}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={deleteTarget.matricule}
            autoComplete="off"
          />
        ) : (
          <Input
            label="Cet établissement n'a pas encore de matricule : tapez son nom exact pour confirmer"
            hint={`Nom attendu : ${deleteTarget?.name}`}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={deleteTarget?.name}
            autoComplete="off"
          />
        )}
        <div className="flex justify-end gap-3" slot="footer">
          <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={busy}>
            Annuler
          </Button>
          <Button
            variant="danger"
            onClick={confirmDelete}
            loading={busy}
            disabled={!deleteTarget || deleteConfirm !== expectedConfirmation(deleteTarget)}
          >
            Supprimer définitivement
          </Button>
        </div>
      </Modal>
    </div>
  );
}
