import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { AsyncView } from "@/components/ui/AsyncView";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Table } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAsync } from "@/hooks/useAsync";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { listAdminAudit, purgeAdminAudit } from "@/services/admin";
import type { AdminAuditRow } from "@/types";
import { actionLabel, roleLabel } from "@/features/admin/labels";
import { formatDateTime } from "@/utils/format";
import { cn } from "@/utils/cn";

type Period = 7 | 30 | 90;

function actionTone(action: string): BadgeTone {
  if (/deleted|blocked|failed|purged|desactive/.test(action)) return "danger";
  if (/created|activated|purchased|renewed/.test(action)) return "success";
  if (/updated|changed|reset/.test(action)) return "info";
  if (/cancelled|warning/.test(action)) return "warning";
  return "neutral";
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function AdminAuditPage() {
  const { isSuperAdmin } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [days, setDays] = useState<Period>(30);
  const [action, setAction] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<AdminAuditRow | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const state = useAsync(
    () => listAdminAudit({ page, pageSize: 25, days, action: action || undefined, search: search || undefined }),
    [page, days, action, search],
  );

  const actionOptions = useMemo(() => {
    const counts = state.data?.actionCounts ?? [];
    return [
      { value: "", label: "Toutes les actions" },
      ...counts.slice(0, 15).map((a) => ({ value: a.action, label: `${actionLabel(a.action)} (${a.count})` })),
    ];
  }, [state.data]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const exportCsv = () => {
    const rows = state.data?.rows ?? [];
    if (rows.length === 0) return;
    const header = ["Date", "Action", "Acteur", "Rôle", "Établissement", "Entité", "Identifiant", "Détails"];
    const lines = rows.map((row) =>
      [
        row.createdAt,
        actionLabel(row.action),
        row.actorName ?? "",
        roleLabel(row.actorRole),
        row.schoolName ?? "",
        row.entity,
        row.entityId ?? "",
        JSON.stringify(row.payload),
      ]
        .map(csvCell)
        .join(";"),
    );
    const blob = new Blob([`\uFEFF${[header.map(csvCell).join(";"), ...lines].join("\r\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Journal d'audit"
        subtitle="Traçabilité des actions sensibles réalisées dans la console d'administration"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon="download" onClick={exportCsv} disabled={!state.data || state.data.rows.length === 0}>
              Exporter la page
            </Button>
            {isSuperAdmin && (
              <Button variant="danger" icon="delete_sweep" onClick={() => setPurgeOpen(true)}>
                Purger
              </Button>
            )}
          </div>
        }
      />

      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          <Icon name="check_circle" fill className="text-[20px] text-emerald-600" />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Fermer le message" className="text-emerald-700">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
      )}

      <AsyncView state={state}>
        {(data) => (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard dark icon="history" label="Événements sur la période" value={data.total.toLocaleString("fr-FR")} note={`${data.periodDays} derniers jours`} />
              <StatCard icon="category" label="Actions distinctes" value={String(data.actionCounts.length)} note="Échantillon des 1 000 derniers événements" />
              <StatCard icon="event_repeat" label="Action la plus fréquente" value={actionLabel(data.actionCounts[0]?.action)} note={data.actionCounts[0] ? `${data.actionCounts[0].count} occurrence(s)` : "Aucune action"} />
              <StatCard icon="shield" label="Conservation configurée" value={`${data.retentionDays} j`} note="Durée par défaut avant purge" />
            </div>

            <Card>
              <CardHeader
                title="Événements"
                subtitle="Filtrez par action, période ou recherchez une entité."
                action={<Badge tone="neutral">{data.total} résultat(s)</Badge>}
              />

              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="flex w-full items-end gap-2 sm:w-auto">
                  <Input
                    label="Rechercher"
                    placeholder="Action, entité ou rôle…"
                    icon="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applySearch();
                    }}
                    className="w-full sm:w-64"
                  />
                  <Button icon="search" onClick={applySearch}>
                    Filtrer
                  </Button>
                </div>
                <Select
                  label="Action"
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value);
                    setPage(1);
                  }}
                  options={actionOptions}
                  compact
                  className="w-full sm:w-64"
                />
                <Select
                  label="Période"
                  value={String(days)}
                  onChange={(e) => {
                    setDays(Number(e.target.value) as Period);
                    setPage(1);
                  }}
                  options={[
                    { value: "7", label: "7 derniers jours" },
                    { value: "30", label: "30 derniers jours" },
                    { value: "90", label: "90 derniers jours" },
                  ]}
                  compact
                  className="w-full sm:w-48"
                />
                {(search || action) && (
                  <Button
                    variant="ghost"
                    icon="filter_alt_off"
                    onClick={() => {
                      setSearch("");
                      setSearchInput("");
                      setAction("");
                      setPage(1);
                    }}
                  >
                    Réinitialiser
                  </Button>
                )}
              </div>

              {data.rows.length === 0 ? (
                <EmptyState icon="history_toggle_off" title="Aucun événement" text="Aucune action journalisée ne correspond à ces critères." />
              ) : (
                <>
                  <Table
                    caption="Journal d'audit administratif"
                    rows={data.rows}
                    rowKey={(row) => row.id}
                    onRowClick={setDetail}
                    columns={[
                      {
                        key: "date",
                        header: "Date",
                        render: (row) => <span className="whitespace-nowrap text-xs text-neutral-600">{formatDateTime(row.createdAt)}</span>,
                      },
                      {
                        key: "action",
                        header: "Action",
                        render: (row) => (
                          <div className="flex items-center gap-2">
                            <Badge tone={actionTone(row.action)}>{actionLabel(row.action)}</Badge>
                          </div>
                        ),
                      },
                      {
                        key: "actor",
                        header: "Acteur",
                        render: (row) => (
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">{row.actorName ?? "Système"}</p>
                            <p className="text-xs text-neutral-500">{roleLabel(row.actorRole)}</p>
                          </div>
                        ),
                      },
                      {
                        key: "school",
                        header: "Établissement",
                        render: (row) => <span className="text-sm text-neutral-700">{row.schoolName ?? "—"}</span>,
                      },
                      {
                        key: "entity",
                        header: "Entité",
                        render: (row) => (
                          <div className="min-w-0">
                            <p className="text-sm">{row.entity}</p>
                            <p className="truncate font-mono text-[11px] text-neutral-400">{row.entityId ?? "—"}</p>
                          </div>
                        ),
                      },
                      {
                        key: "details",
                        header: "",
                        align: "right",
                        render: () => (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-forest">
                            Détails <Icon name="chevron_right" className="text-[16px]" />
                          </span>
                        ),
                      },
                    ]}
                  />
                  <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
                </>
              )}
            </Card>
          </div>
        )}
      </AsyncView>

      <AuditDetailModal row={detail} onClose={() => setDetail(null)} />

      <PurgeModal
        open={purgeOpen}
        defaultDays={state.data?.retentionDays ?? 365}
        onClose={() => setPurgeOpen(false)}
        onDone={(message) => {
          setPurgeOpen(false);
          setNotice(message);
          setPage(1);
          state.reload();
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

function AuditDetailModal({ row, onClose }: { row: AdminAuditRow | null; onClose: () => void }) {
  const entries = row ? Object.entries(row.payload ?? {}) : [];
  return (
    <Modal open={!!row} onClose={onClose} title="Détail de l'événement" size="md" footer={<Button variant="outline" onClick={onClose}>Fermer</Button>}>
      {row && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={actionTone(row.action)}>{actionLabel(row.action)}</Badge>
            <span className="text-xs text-neutral-500">{formatDateTime(row.createdAt)}</span>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <Info label="Acteur" value={row.actorName ?? "Système"} />
            <Info label="Rôle" value={roleLabel(row.actorRole)} />
            <Info label="Établissement" value={row.schoolName ?? "—"} />
            <Info label="Entité" value={row.entity} />
            <Info label="Identifiant de l'entité" value={row.entityId ?? "—"} mono />
            <Info label="Identifiant d'acteur" value={row.actorId ?? "—"} mono />
          </dl>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Charge utile</p>
            {entries.length === 0 ? (
              <p className="rounded-xl bg-mist px-3 py-2 text-sm text-neutral-500">Aucune donnée complémentaire.</p>
            ) : (
              <div className="space-y-1.5">
                {entries.map(([key, value]) => (
                  <div key={key} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-neutral-100 px-3 py-2">
                    <span className="font-mono text-xs text-neutral-500">{key}</span>
                    <span className={cn("max-w-[65%] break-words text-right text-sm text-ink", typeof value !== "string" && "font-mono text-xs")}>
                      {typeof value === "string" ? value : JSON.stringify(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-100 px-3 py-2">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className={cn("mt-0.5 break-words text-sm text-ink", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

function PurgeModal({
  open,
  defaultDays,
  onClose,
  onDone,
}: {
  open: boolean;
  defaultDays: number;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [value, setValue] = useState(String(defaultDays));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const days = Number(value);

  useEffect(() => {
    if (open) {
      setValue(String(defaultDays));
      setError("");
    }
  }, [open, defaultDays]);

  const submit = async () => {
    setError("");
    if (!Number.isInteger(days) || days < 30 || days > 3650) {
      setError("La période doit être un entier entre 30 et 3 650 jours.");
      return;
    }
    setBusy(true);
    try {
      const res = await purgeAdminAudit(days);
      onDone(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "La purge a échoué.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Purger le journal d'audit"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button variant="danger" icon="delete_sweep" loading={busy} onClick={submit}>
            Purger définitivement
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
          <Icon name="warning" fill className="mt-0.5 text-[22px] text-danger" />
          <p className="text-sm leading-relaxed text-red-900">
            Les événements antérieurs à la période choisie seront <strong>supprimés définitivement</strong>. La purge elle-même est
            journalisée pour conserver la trace de l'opération.
          </p>
        </div>
        <Input
          label="Conserver les événements des X derniers jours"
          type="number"
          min={30}
          max={3650}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          hint="Entre 30 et 3 650 jours. La valeur par défaut provient des paramètres de la plateforme."
        />
        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-danger">
            <Icon name="error" className="text-[20px]" />
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
