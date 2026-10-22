import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AsyncView } from "@/components/ui/AsyncView";
import { Avatar } from "@/components/ui/Brand";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterSheet } from "@/components/ui/FilterSheet";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { Table, type Column } from "@/components/ui/Table";
import { useCurrentUser } from "@/context/AuthContext";
import { CYCLES, CYCLE_LABELS } from "@/data/school";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { listStudentRows, type StudentRow } from "@/services/studentService";
import { formatCurrency, formatDate, pluralize } from "@/utils/format";
import { STUDENT_STATUS_LABELS } from "@/utils/payments";

const PAGE_SIZE = 10;
const STATUS_TONE = { a_jour: "success", partiel: "warning", impaye: "danger" } as const;

export default function StudentsPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const state = useAsync(() => listStudentRows(user), [user.id]);
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 250);
  const [cycle, setCycle] = useState("");
  const [pay, setPay] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const classId = params.get("classe") ?? "";
  const showMoney = user.role === "directeur" || user.role === "econome";
  const rows = useMemo(() => state.data ?? [], [state.data]);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.filter((r) => !cycle || r.cycle === cycle).forEach((r) => map.set(r.classId, r.className));
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true }));
  }, [rows, cycle]);

  const filtered = useMemo(() => {
    const term = dq.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!term || `${r.firstName} ${r.lastName} ${r.matricule} ${r.parentName}`.toLowerCase().includes(term)) &&
        (!cycle || r.cycle === cycle) &&
        (!classId || r.classId === classId) &&
        (!pay || r.payStatus === pay),
    );
  }, [rows, dq, cycle, classId, pay]);

  useEffect(() => setPage(1), [dq, cycle, classId, pay]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isTeacher = user.role === "instituteur" || user.role === "professeur";

  const columns: Column<StudentRow>[] = [
    {
      key: "name",
      header: "Élève",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${r.firstName} ${r.lastName}`} size={38} />
          <div>
            <p className="font-semibold">
              {r.firstName} {r.lastName}
            </p>
            <p className="text-xs text-neutral-500">{r.matricule}</p>
          </div>
        </div>
      ),
    },
    { key: "class", header: "Classe", render: (r) => <Badge tone="lime">{r.className}</Badge> },
    { key: "cycle", header: "Cycle", render: (r) => CYCLE_LABELS[r.cycle] },
    { key: "birth", header: "Naissance", render: (r) => formatDate(r.birthDate) },
    { key: "parent", header: "Parent", render: (r) => <span>{r.parentName}<span className="block text-xs text-neutral-500">{r.parentPhone}</span></span> },
    ...(showMoney
      ? ([
          { key: "pay", header: "Paiement", render: (r) => <Badge tone={STATUS_TONE[r.payStatus]}>{STUDENT_STATUS_LABELS[r.payStatus]}</Badge> },
          { key: "bal", header: "Solde dû", align: "right", render: (r) => (r.balance > 0 ? <span className="font-semibold text-danger">{formatCurrency(r.balance)}</span> : "—") },
        ] as Column<StudentRow>[])
      : []),
    { key: "go", header: <span className="sr-only">Ouvrir</span>, align: "right", render: () => <Icon name="chevron_right" className="text-neutral-400" /> },
  ];

  const activeFilters = [cycle, classId, pay].filter(Boolean).length;
  const filterFields = (
    <>
      <Select compact aria-label="Filtrer par cycle" placeholder="Tous les cycles" value={cycle} onChange={(e) => { setCycle(e.target.value); setParams({}); }} options={CYCLES.map((c) => ({ value: c, label: CYCLE_LABELS[c] }))} />
      <Select compact aria-label="Filtrer par classe" placeholder="Toutes les classes" value={classId} onChange={(e) => setParams(e.target.value ? { classe: e.target.value } : {})} options={classOptions} />
      {showMoney && <Select compact aria-label="Filtrer par statut de paiement" placeholder="Tous les paiements" value={pay} onChange={(e) => setPay(e.target.value)} options={Object.entries(STUDENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />}
    </>
  );

  return (
    <>
      <PageHeader
        title={isTeacher ? "Mes élèves" : "Élèves"}
        subtitle={`${rows.length} ${pluralize(rows.length, "élève", "élèves")} · année scolaire 2026-2027`}
        actions={user.role === "directeur" && <LinkButton to="/app/inscription-eleve" icon="person_add">Inscrire un élève</LinkButton>}
      />
      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input aria-label="Rechercher un élève" icon="search" placeholder="Nom, matricule, parent…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="hidden md:contents">{filterFields}</div>
        </div>
        <div className="mt-3 flex items-center gap-2 md:hidden">
          <button type="button" onClick={() => setFiltersOpen(true)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-forest">
            <Icon name="tune" className="text-[20px]" />
            Filtres
            {activeFilters > 0 && <span className="grid min-w-6 place-items-center rounded-full bg-lime px-1.5 text-xs font-bold leading-6 text-forest">{activeFilters}</span>}
          </button>
          {activeFilters > 0 && (
            <button type="button" onClick={() => { setCycle(""); setPay(""); setParams({}); }} className="min-h-12 rounded-2xl px-3 text-sm font-semibold text-neutral-600">
              Réinitialiser
            </button>
          )}
        </div>
      </Card>
      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        footer={<button type="button" onClick={() => setFiltersOpen(false)} className="min-h-12 w-full rounded-full bg-forest text-sm font-semibold text-white">Afficher les résultats</button>}
      >
        <div className="grid gap-3">{filterFields}</div>
      </FilterSheet>
      <AsyncView state={state} skeleton={<SkeletonTable />}>
        {() =>
          filtered.length === 0 ? (
            <EmptyState icon="search_off" title="Aucun élève trouvé" text="Modifiez votre recherche ou vos filtres." />
          ) : (
            <Card padded={false} className="p-2">
              <Table caption="Liste des élèves" columns={columns} rows={pageRows} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/app/eleves/${r.id}`)} stagger />
              <div className="px-4 pb-4">
                <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
              </div>
            </Card>
          )
        }
      </AsyncView>
    </>
  );
}
