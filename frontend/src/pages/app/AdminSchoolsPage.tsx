import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { AsyncView } from "@/components/ui/AsyncView";
import { Card, CardHeader } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { LinkButton } from "@/components/ui/Button";
import { useAsync } from "@/hooks/useAsync";
import { listAdminSchools, type ListSchoolsParams, type ListSchoolsResult } from "@/services/admin";
import type { AdminSchool } from "@/types";
import { formatDate } from "@/utils/format";

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
        {(s) => <Content s={s} updateQuery={updateQuery} setPageState={setPageState} setPageSizeState={setPageSizeState} />}
      </AsyncView>
    </>
  );
}

function Content({
  s,
  updateQuery,
  setPageState,
  setPageSizeState,
}: {
  s: ListSchoolsResult;
  updateQuery: (u: Record<string, string | null>) => void;
  setPageState: (p: number) => void;
  setPageSizeState: (p: number) => void;
}) {
  void setPageSizeState;
  return (
    <div className="space-y-4">
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
                const active = r.matricule && r.registrationOpen;
                return (
                  <Badge tone={active ? "success" : "danger"}>
                    {active ? "Actif" : "Suspendu"}
                  </Badge>
                );
              },
            },
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
    </div>
  );
}