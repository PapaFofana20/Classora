import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/ui/Brand";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { AsyncView } from "@/components/ui/AsyncView";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { LinkButton } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCurrentUser } from "@/context/AuthContext";
import { useSchool } from "@/context/SchoolContext";
import { useChild } from "@/context/ChildContext";
import { useToast } from "@/context/ToastContext";
import { CYCLE_LABELS } from "@/data/school";
import { useAsync } from "@/hooks/useAsync";
import { linkChild } from "@/services/authService";
import { getStudentDetail } from "@/services/studentService";
import { formatMatriculeInput, CHILD_CODE_LENGTH } from "@/utils/matricule";
import { formatCurrency, formatNumber } from "@/utils/format";
import { averageTone } from "@/utils/grades";
import { STUDENT_STATUS_LABELS } from "@/utils/payments";

export function ParentHome() {
  const user = useCurrentUser();
  const { schoolName } = useSchool();
  const { children, activeChild, setActiveChildId, loading, error, reload } = useChild();
  const detail = useAsync(() => (activeChild ? getStudentDetail(user, activeChild.id) : Promise.resolve(null)), [activeChild?.id]);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && !error && children.length === 0)
    return <EmptyState icon="child_care" title="Aucun enfant rattaché à votre compte" text="Contactez l'école pour rattacher vos enfants à votre compte parent." action={<Button icon="add" onClick={() => setOpen(true)}>Ajouter un enfant avec son code</Button>} />;

  const addChild = async () => {
    if (code.length !== CHILD_CODE_LENGTH) return;
    setBusy(true);
    try {
      const child = await linkChild(user, code);
      toast(`${child.firstName} ${child.lastName} est rattaché à votre compte.`);
      setOpen(false);
      setCode("");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Rattachement impossible.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Suivi de mes enfants"
        subtitle={`${schoolName} · résultats et paiements de vos enfants.`}
        actions={<Button icon="add" onClick={() => setOpen(true)}>Ajouter un enfant</Button>}
      />
      {error && (
        <button type="button" onClick={reload} className="mb-4 underline">
          Réessayer
        </button>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {children.map((c) => {
          const active = c.id === activeChild?.id;
          return (
            <button key={c.id} type="button" onClick={() => setActiveChildId(c.id)} aria-pressed={active} className={`flex items-center gap-4 rounded-2xl p-5 text-left shadow-card transition-all hover:-translate-y-1 ${active ? "bg-forest text-white" : "bg-white"}`}>
              <Avatar name={`${c.firstName} ${c.lastName}`} size={56} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-extrabold">
                  {c.firstName} {c.lastName}
                </p>
                <p className={`text-sm ${active ? "text-white/75" : "text-neutral-500"}`}>
                  {c.className} · {CYCLE_LABELS[c.cycle]}
                </p>
              </div>
              <Badge tone={c.payStatus === "a_jour" ? "success" : c.payStatus === "partiel" ? "warning" : "danger"}>{STUDENT_STATUS_LABELS[c.payStatus]}</Badge>
            </button>
          );
        })}
      </div>
      <AsyncView state={detail} skeleton={<Skeleton className="h-64 w-full" />}>
        {(d) =>
          d && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard dark icon="grade" label="Moyenne générale" value={d.report?.generalAverage == null ? "—" : `${formatNumber(d.report.generalAverage)} / 20`} note="1er semestre" />
                <StatCard icon="emoji_events" label="Rang" value={d.report?.rank ? `${d.report.rank}${d.report.rank === 1 ? "er" : "e"} / ${d.report.classSize}` : "—"} note={d.classRoom.name} />
                <StatCard icon="event_busy" label="Absences" value={String(d.report?.meta.absences ?? 0)} note={`Conduite : ${d.report?.meta.conduct ?? "—"}`} />
                <StatCard icon="payments" label="Reste dû (échu)" value={formatCurrency(d.row.balance)} badge={d.row.balance > 0 ? { text: "À régler", tone: "down" } : { text: "À jour", tone: "up" }} />
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                  <CardHeader title={`Résultats de ${d.row.firstName}`} subtitle="Moyenne par matière (1er semestre)" action={<LinkButton to="/app/notes" variant="ghost" size="sm">Détails</LinkButton>} />
                  <ul className="space-y-3">
                    {(d.report?.lines ?? []).map((l) => (
                      <li key={l.subjectId} className="flex items-center gap-3">
                        <span className="w-44 truncate text-sm font-medium">{l.subjectName}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                          <div className="h-full rounded-full bg-leaf" style={{ width: `${((l.average ?? 0) / 20) * 100}%` }} />
                        </div>
                        <Badge tone={averageTone(l.average)} className="w-16 justify-center">
                          {l.average === null ? "—" : formatNumber(l.average)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card>
                  <CardHeader title="Accès rapides" />
                  <div className="grid gap-2">
                    <Link to="/app/bulletins" className="flex min-h-12 items-center gap-3 rounded-xl bg-lime-soft px-4 text-sm font-semibold hover:bg-lime">Voir le bulletin</Link>
                    <Link to="/app/paiements" className="flex min-h-12 items-center gap-3 rounded-xl bg-lime-soft px-4 text-sm font-semibold hover:bg-lime">Payer une mensualité</Link>
                    <Link to="/app/messages" className="flex min-h-12 items-center gap-3 rounded-xl bg-lime-soft px-4 text-sm font-semibold hover:bg-lime">Écrire à un enseignant</Link>
                  </div>
                </Card>
              </div>
            </div>
          )
        }
      </AsyncView>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ajouter un enfant"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button variant="dark" loading={busy} disabled={code.length !== CHILD_CODE_LENGTH} onClick={() => void addChild()}>
              Rattacher
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-2xl bg-lime-soft p-4 text-sm font-medium text-forest">
            <Icon name="confirmation_number" className="text-[20px]" />
            Saisissez le code élève communiqué par {schoolName}. Il comporte {CHILD_CODE_LENGTH} caractères.
          </p>
          <Input
            label="Code élève"
            required
            inputMode="text"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="K4M2P7"
            value={code}
            onChange={(e) => setCode(formatMatriculeInput(e.target.value, CHILD_CODE_LENGTH))}
            error={code && code.length !== CHILD_CODE_LENGTH ? `${CHILD_CODE_LENGTH} caractères attendus.` : null}
          />
        </div>
      </Modal>
    </>
  );
}
