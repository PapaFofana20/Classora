import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useCurrentUser, useAuth } from "@/context/AuthContext";
import { useSchool } from "@/context/SchoolContext";
import { useToast } from "@/context/ToastContext";
import { CYCLES, CYCLE_EXAMS, CYCLE_LABELS, getPeriods } from "@/data/school";
import { ROLE_LABELS } from "@/utils/permissions";
import { resetDatabase } from "@/services/db";
import { addSubject, setAutoApprove, toggleRegistration, updateSettings, type SchoolOverview } from "@/services/schoolService";
import { Switch } from "@/components/ui/Switch";
import type { Cycle, PeriodType, School } from "@/types";
import { cn } from "@/utils/cn";
import { isValidEmail } from "@/utils/format";

interface TabProps {
  overview: SchoolOverview;
  onSaved: () => void;
}

function useSave(onSaved: () => void) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (op: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await op();
      toast(ok);
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Enregistrement impossible.", "error");
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export function SchoolTab({ overview, onSaved }: TabProps) {
  const { schoolId } = useAuth();
  const s = overview.settings;
  const [f, setF] = useState({ name: s.name, address: s.address, phone: s.phone, email: s.email });
  const [reset, setReset] = useState(false);
  const { busy, run } = useSave(onSaved);
  const errors = { name: f.name.trim().length < 3 ? "Nom trop court." : null, email: !isValidEmail(f.email) ? "E-mail invalide." : null };
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Informations de l'école" subtitle={`Année scolaire ${s.schoolYear}`} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nom de l'école" required placeholder="Ex. Groupe Scolaire Les Baobabs" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} />
          <Input label="Téléphone" placeholder="77 123 45 67" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <Input label="E-mail" type="email" placeholder="contact@ecole.sn" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errors.email} />
          <Input label="Adresse" placeholder="Quartier, rue, numéro" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </div>
        <Button className="mt-5" variant="dark" icon="save" loading={busy} disabled={!!errors.name || !!errors.email} onClick={() => void run(() => updateSettings(schoolId, { ...f, name: f.name.trim() }), "Informations enregistrées.")}>Enregistrer</Button>
      </Card>
      {overview.school && <RegistrationTab school={overview.school} onSaved={onSaved} />}
      <Card>
        <CardHeader title="Données de démonstration" subtitle="Remet l'application dans son état initial (notes, paiements, messages, affectations)." />
        <Button variant="outline" icon="restart_alt" onClick={() => setReset(true)}>Réinitialiser les données</Button>
      </Card>
      <ConfirmDialog open={reset} title="Réinitialiser les données ?" message="Toutes vos modifications (notes, paiements, affectations, messages) seront perdues." confirmLabel="Réinitialiser" onCancel={() => setReset(false)} onConfirm={() => { resetDatabase(); window.location.reload(); }} />
    </div>
  );
}

/** Inscriptions en ligne : ouverture des inscriptions et approbation automatique. */
export function RegistrationTab({ school, onSaved }: { school: School; onSaved: () => void }) {
  const { busy, run } = useSave(onSaved);
  return (
    <Card>
      <CardHeader title="Inscriptions" subtitle="Matricule, ouverture des inscriptions et validation automatique des élèves." />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-mist p-4">
          <Icon name="key" className="text-[22px] text-forest" />
          <p className="text-sm text-neutral-700">
            Matricule de l'école : <strong className="tracking-[0.3em] text-forest">{school.matricule || "—"}</strong>
          </p>
        </div>
        <Switch
          id="settings-registration"
          checked={school.registrationOpen}
          disabled={busy}
          onChange={(v) => void run(() => toggleRegistration(school.id, v), v ? "Inscriptions ouvertes." : "Inscriptions fermées.")}
          label="Accepter les inscriptions en ligne"
          description="Les élèves et parents peuvent créer leur compte avec ce matricule. Le matricule reste le même, seul l'accès est suspendu."
        />
        <Switch
          id="settings-auto-approve"
          checked={school.autoApproveStudents}
          disabled={busy}
          onChange={(v) => void run(() => setAutoApprove(school.id, v), v ? "Approbation automatique activée." : "Approbation automatique désactivée.")}
          label="Approbation automatique des élèves"
          description="Activée, chaque inscription d'élève est validée immédiatement. Désactivée (par défaut), les demandes attendent la validation de la direction dans « Demandes d'inscription »."
        />
      </div>
    </Card>
  );
}

export function CyclesTab({ overview, onSaved }: TabProps) {
  const { schoolId } = useAuth();
  const [cycles, setCycles] = useState<Cycle[]>(overview.settings.cycles);
  const { busy, run } = useSave(onSaved);
  const toggle = (c: Cycle) => setCycles((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]));
  const levelsOf = (c: Cycle) => overview.levels.filter((l) => l.cycle === c).map((l) => l.label).join(", ");
  return (
    <Card>
      <CardHeader title="Cycles proposés par l'école" subtitle="Une école peut proposer un ou plusieurs cycles." />
      <div className="grid gap-3 md:grid-cols-3">
        {CYCLES.map((c) => {
          const on = cycles.includes(c);
          return (
            <label key={c} className={cn("cursor-pointer rounded-2xl border-2 p-5 transition", on ? "border-forest bg-lime-pale" : "border-neutral-200")}>
              <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(c)} />
              <span className="flex items-center justify-between"><span className="text-lg font-extrabold">{CYCLE_LABELS[c]}</span><Icon name={on ? "check_circle" : "radio_button_unchecked"} fill={on} className={on ? "text-forest" : "text-neutral-300"} /></span>
              <span className="mt-2 block text-sm text-neutral-600">{levelsOf(c)}</span>
              <Badge tone="dark" className="mt-3">Examen : {CYCLE_EXAMS[c]}</Badge>
            </label>
          );
        })}
      </div>
      {cycles.length === 0 && <p role="alert" className="mt-3 text-sm font-medium text-danger">Sélectionnez au moins un cycle.</p>}
      <Button className="mt-5" variant="dark" icon="save" loading={busy} disabled={cycles.length === 0} onClick={() => void run(() => updateSettings(schoolId, { cycles }), "Cycles enregistrés.")}>Enregistrer</Button>
    </Card>
  );
}

export function PeriodsTab({ overview, onSaved }: TabProps) {
  const { schoolId } = useAuth();
  const [type, setType] = useState<PeriodType>(overview.settings.periodType);
  const [current, setCurrent] = useState(overview.settings.currentPeriod);
  const { busy, run } = useSave(onSaved);
  const periods = getPeriods(type);
  const effective = periods.some((p) => p.id === current) ? current : periods[0].id;
  return (
    <Card>
      <CardHeader title="Périodes d'évaluation" subtitle="Semestres ou trimestres : par matière, 2 devoirs + 1 composition (moyen et secondaire)." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Découpage de l'année" value={type} onChange={(e) => setType(e.target.value === "trimestre" ? "trimestre" : "semestre")} options={[{ value: "semestre", label: "2 semestres" }, { value: "trimestre", label: "3 trimestres" }]} />
        <Select label="Période en cours" value={effective} onChange={(e) => setCurrent(e.target.value)} options={periods.map((p) => ({ value: p.id, label: p.label }))} />
      </div>
      <Button className="mt-5" variant="dark" icon="save" loading={busy} onClick={() => void run(() => updateSettings(schoolId, { periodType: type, currentPeriod: effective }), "Périodes enregistrées.")}>Enregistrer</Button>
    </Card>
  );
}

export function SubjectsTab({ overview, onSaved }: TabProps) {
  const { schoolId } = useAuth();
  const [name, setName] = useState("");
  const [cycles, setCycles] = useState<Cycle[]>(["moyen", "secondaire"]);
  const { busy, run } = useSave(onSaved);
  const valid = name.trim().length >= 3 && cycles.length > 0;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader title="Matières" subtitle={`${overview.subjects.length} matières configurées`} />
        <ul className="divide-y divide-neutral-100">
          {overview.subjects.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="font-semibold">{s.name}</span>
              <span className="flex gap-1.5">{s.cycles.map((c) => <Badge key={c} tone="lime">{CYCLE_LABELS[c]}</Badge>)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Ajouter une matière" />
        <Input label="Nom de la matière" placeholder="Ex. Mathématiques" value={name} onChange={(e) => setName(e.target.value)} error={name && name.trim().length < 3 ? "Nom trop court." : null} />
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-semibold">Cycles concernés</legend>
          <div className="flex flex-wrap gap-2">
            {CYCLES.map((c) => (
              <label key={c} className={cn("flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium", cycles.includes(c) ? "border-forest bg-lime" : "border-neutral-200")}>
                <input type="checkbox" className="sr-only" checked={cycles.includes(c)} onChange={() => setCycles((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]))} />
                {CYCLE_LABELS[c]}
              </label>
            ))}
          </div>
        </fieldset>
        <Button className="mt-5" variant="dark" icon="add" disabled={!valid} loading={busy} onClick={() => void run(async () => { await addSubject(schoolId, name, cycles); setName(""); }, "Matière ajoutée.")}>Ajouter</Button>
      </Card>
    </div>
  );
}

export function ProfileTab() {
  const user = useCurrentUser();
  const { schoolName } = useSchool();
  return (
    <Card>
      <CardHeader title="Mon profil" />
      <dl className="grid gap-3 sm:grid-cols-2">
        {[
          ["Nom", `${user.firstName} ${user.lastName}`],
          ["E-mail", user.email],
          ["Rôle", ROLE_LABELS[user.role]],
          ["École", schoolName],
          ["Année scolaire", "2026-2027"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-mist p-4">
            <dt className="text-xs font-semibold uppercase text-neutral-500">{k}</dt>
            <dd className="mt-1 font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
