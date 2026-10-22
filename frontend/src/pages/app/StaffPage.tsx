import { useState } from "react";
import { AsyncView } from "@/components/ui/AsyncView";
import { Avatar } from "@/components/ui/Brand";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterSheet } from "@/components/ui/FilterSheet";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { Table, type Column } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { StaffCredentialsModal } from "@/features/staff/StaffCredentialsModal";
import { StaffForm, type StaffFormValue } from "@/features/staff/StaffForm";
import { useCurrentUser } from "@/context/AuthContext";
import { useSchool } from "@/context/SchoolContext";
import { useToast } from "@/context/ToastContext";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { createStaffAccount, listStaff, resetStaffPassword, setStaffActive, updateStaff, type StaffCredentials, type StaffRow } from "@/services/authService";
import { getSchoolOverview } from "@/services/schoolService";
import { listTeacherRows } from "@/services/teacherService";
import { STAFF_ROLE_LABELS } from "@/utils/permissions";
import { cn } from "@/utils/cn";
import { isValidEmail } from "@/utils/format";

type Tab = "comptes" | "enseignants";

/** /app/enseignants — directeur uniquement : accès du personnel et enseignants. */
export default function StaffPage() {
  const user = useCurrentUser();
  const { schoolId, school, readOnly } = useSchool();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("comptes");
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 250);
  const [role, setRole] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<StaffCredentials | null>(null);

  const state = useAsync(async () => ({ staff: await listStaff(schoolId), overview: await getSchoolOverview(schoolId), teachers: await listTeacherRows(schoolId) }), [schoolId]);

  const staff = state.data?.staff ?? [];
  const teachers = state.data?.teachers ?? [];
  const subjects = (state.data?.overview.subjects ?? []).filter((s) => s.cycles.some((c) => c !== "elementaire")).map((s) => ({ id: s.id, name: s.name }));

  const filteredStaff = staff.filter((s) => (!role || s.role === role) && `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(dq.trim().toLowerCase()));
  const filteredTeachers = teachers.filter((t) => `${t.firstName} ${t.lastName} ${t.email}`.toLowerCase().includes(dq.trim().toLowerCase()));

  const submit = async (value: StaffFormValue) => {
    setBusy(true);
    try {
      if (editing) {
        await updateStaff(user, editing.userId, { firstName: value.firstName, lastName: value.lastName, email: value.email, phone: value.phone, specialties: value.specialties });
        toast("Accès mis à jour.");
        setOpen(false);
        setEditing(null);
      } else {
        const created = await createStaffAccount(user, { role: value.role, firstName: value.firstName, lastName: value.lastName, email: value.email, phone: value.phone, specialties: value.role === "instituteur" ? [] : value.specialties, tempPassword: value.tempPassword });
        setCredentials(created);
        setOpen(false);
        toast("Accès créé. Communiquez les identifiants à l'intéressé.");
      }
      state.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Enregistrement impossible.", "error");
    } finally {
      setBusy(false);
    }
  };

  const reset = async (row: StaffRow) => {
    setBusy(true);
    try {
      const creds = await resetStaffPassword(user, row.userId);
      setCredentials(creds);
      toast("Nouveau mot de passe temporaire généré.");
      state.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Réinitialisation impossible.", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: StaffRow) => {
    setBusy(true);
    try {
      await setStaffActive(user, row.userId, row.status !== "ACTIF");
      toast(row.status === "ACTIF" ? "Compte désactivé : cet utilisateur ne peut plus se connecter." : "Compte réactivé.");
      state.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Modification impossible.", "error");
    } finally {
      setBusy(false);
    }
  };

  const roleFilter = <Select compact aria-label="Filtrer par rôle" placeholder="Tous les rôles" value={role} onChange={(e) => setRole(e.target.value)} options={Object.entries(STAFF_ROLE_LABELS).map(([value, label]) => ({ value, label }))} />;

  const staffCols: Column<StaffRow>[] = [
    { key: "who", header: "Personnel", render: (s) => (<div className="flex items-center gap-3"><Avatar name={`${s.firstName} ${s.lastName}`} size={38} /><div><p className="font-semibold">{s.firstName} {s.lastName}</p><p className="text-xs text-neutral-500">{s.email}</p></div></div>) },
    { key: "role", header: "Rôle", render: (s) => <Badge tone={s.role === "instituteur" ? "info" : "lime"}>{STAFF_ROLE_LABELS[s.role as keyof typeof STAFF_ROLE_LABELS] ?? s.role}</Badge> },
    { key: "phone", header: "Téléphone", render: (s) => s.phone },
    { key: "status", header: "Statut", render: (s) => (<span className="flex flex-wrap gap-1.5">{s.status === "DESACTIVE" ? <Badge tone="danger">Désactivé</Badge> : <Badge tone="success">Actif</Badge>}{s.mustChangePassword && <Badge tone="warning">Mot de passe à changer</Badge>}</span>) },
    {
      key: "actions",
      align: "right",
      header: <span className="sr-only">Actions</span>,
      render: (s) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" aria-label={`Modifier ${s.firstName}`} onClick={() => { setEditing(s); setOpen(true); }}>
            <Icon name="edit" className="text-[18px]" />
          </Button>
          <Button size="sm" variant="ghost" aria-label={`Réinitialiser le mot de passe de ${s.firstName}`} onClick={() => void reset(s)}>
            <Icon name="key" className="text-[18px]" />
          </Button>
          <Button size="sm" variant={s.status === "ACTIF" ? "ghost" : "outline"} onClick={() => void toggleActive(s)}>
            {s.status === "ACTIF" ? "Désactiver" : "Réactiver"}
          </Button>
        </div>
      ),
    },
  ];

  const teacherCols: Column<(typeof teachers)[number]>[] = [
    { key: "who", header: "Enseignant", render: (t) => (<div className="flex items-center gap-3"><Avatar name={`${t.firstName} ${t.lastName}`} size={38} /><div><p className="font-semibold">{t.firstName} {t.lastName}</p><p className="text-xs text-neutral-500">{t.email}</p></div></div>) },
    { key: "kind", header: "Fonction", render: (t) => <Badge tone={t.kind === "instituteur" ? "info" : "lime"}>{t.kind === "instituteur" ? "Instituteur" : "Professeur"}</Badge> },
    { key: "classes", header: "Classes", render: (t) => (t.classNames.length ? t.classNames.join(", ") : <span className="text-neutral-400">Aucune</span>) },
    { key: "subjects", header: "Matières", render: (t) => (t.kind === "instituteur" ? "Toutes les matières" : t.subjectNames.join(", ") || "—") },
    { key: "head", header: "Responsabilité", render: (t) => (t.headOf.length ? <Badge tone="dark">{t.kind === "instituteur" ? "Titulaire" : "Principal"} · {t.headOf.join(", ")}</Badge> : "—") },
    { key: "account", header: "Accès", render: (t) => (t.userId ? <Badge tone="success">Compte actif</Badge> : <Badge tone="neutral">Sans accès</Badge>) },
  ];

  return (
    <>
      <PageHeader
        title="Personnel de l'école"
        subtitle="Créez les accès enseignants, économe et surveillant. Un enseignant désactivé ne peut plus se connecter."
        actions={<Button icon="person_add" onClick={() => { setEditing(null); setOpen(true); }} disabled={readOnly}>Créer un accès enseignant</Button>}
      />
      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input aria-label="Rechercher" icon="search" placeholder="Nom, e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="hidden md:contents">{roleFilter}</div>
        </div>
        <div className="mt-3 flex items-center gap-2 md:hidden">
          <button type="button" onClick={() => setFiltersOpen(true)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-forest">
            <Icon name="tune" className="text-[20px]" />
            Filtres
            {role && <span className="grid min-w-6 place-items-center rounded-full bg-lime px-1.5 text-xs font-bold leading-6 text-forest">1</span>}
          </button>
          {role && (
            <button type="button" onClick={() => setRole("")} className="min-h-12 rounded-2xl px-3 text-sm font-semibold text-neutral-600">
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
        {roleFilter}
      </FilterSheet>
      <Tabs
        className="mb-4"
        label="Vue du personnel"
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        items={[
          { id: "comptes", label: "Comptes d'accès", icon: "key", badge: staff.length },
          { id: "enseignants", label: "Enseignants", icon: "badge", badge: teachers.length },
        ]}
      />
      <AsyncView state={state} skeleton={<SkeletonTable />}>
        {() =>
          tab === "comptes" ? (
            filteredStaff.length === 0 ? (
              <EmptyState icon="badge" title="Aucun accès" text="Créez un accès enseignant, économe ou surveillant pour votre école." action={<Button icon="person_add" onClick={() => setOpen(true)}>Créer un accès</Button>} />
            ) : (
              <Card padded={false} className="p-2">
                <Table caption="Comptes d'accès du personnel" columns={staffCols} rows={filteredStaff} rowKey={(s) => s.userId} stagger />
              </Card>
            )
          ) : filteredTeachers.length === 0 ? (
            <EmptyState icon="person_search" title="Aucun enseignant" text="Modifiez votre recherche." />
          ) : (
            <Card padded={false} className="p-2">
              <Table caption="Liste des enseignants" columns={teacherCols} rows={filteredTeachers} rowKey={(t) => t.id} stagger />
            </Card>
          )
        }
      </AsyncView>

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? `Modifier l'accès de ${editing.firstName}` : "Créer un accès enseignant"} size="lg">
        <StaffForm
          subjects={subjects}
          initial={editing ? { role: editing.role as StaffFormValue["role"], firstName: editing.firstName, lastName: editing.lastName, email: editing.email, phone: editing.phone, tempPassword: "" } : undefined}
          submitLabel={editing ? "Enregistrer" : "Créer l'accès"}
          busy={busy}
          onCancel={() => { setOpen(false); setEditing(null); }}
          onSubmit={submit}
        />
      </Modal>

      <StaffCredentialsModal open={!!credentials} credentials={credentials} school={school} onClose={() => setCredentials(null)} />

      {readOnly && (
        <p className={cn("mt-4 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-900")}>
          École en lecture seule (abonnement expiré) : la création de comptes est désactivée.
        </p>
      )}
      {staff.some((s) => s.mustChangePassword) && (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm font-medium text-amber-900">
          <Icon name="info" className="text-[20px]" />
          Certains comptes n'ont pas encore changé leur mot de passe temporaire. Rappelez-le lors de votre prochain point.
        </p>
      )}
      <p className="mt-4 text-xs text-neutral-500">Adresses e-mail valides uniquement : {staff.filter((s) => isValidEmail(s.email)).length}/{staff.length} comptes conformes.</p>
    </>
  );
}