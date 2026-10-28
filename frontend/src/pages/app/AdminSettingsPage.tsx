import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { AsyncView } from "@/components/ui/AsyncView";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input, Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useAsync, type AsyncState } from "@/hooks/useAsync";
import { usePlatformStatus } from "@/context/PlatformContext";
import { getAdminSettings, purgeAdminAudit, updateAdminSettings } from "@/services/admin";
import type { AdminSettingsData, PlatformSettings } from "@/types";
import { formatDateTime, isValidEmail, isValidSnPhone } from "@/utils/format";
import { cn } from "@/utils/cn";

const SQL_FILE = "backend/supabase/migrations/20260101000031_platform_settings.sql";

export default function AdminSettingsPage() {
  const state = useAsync(() => getAdminSettings(), []);
  return (
    <>
      <PageHeader
        title="Paramètres de la plateforme"
        subtitle="Identité, inscriptions, maintenance, sessions et conservation du journal d'audit"
        actions={<LinkButton to="/admin/supervision/audit" variant="outline" icon="history">Journal d'audit</LinkButton>}
      />
      <AsyncView state={state}>{(data) => <SettingsForm data={data} state={state} />}</AsyncView>
    </>
  );
}

function SettingsForm({
  data,
  state,
}: {
  data: AdminSettingsData;
  state: AsyncState<AdminSettingsData>;
}) {
  const { refresh } = usePlatformStatus();
  const [draft, setDraft] = useState<PlatformSettings>(data.settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purging, setPurging] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(data.settings);
  }, [data.settings]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(data.settings), [draft, data.settings]);
  const locked = !data.canEdit || !data.migrationApplied;

  const update = <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const validate = (): string | null => {
    if (draft.platformName.trim().length < 2) return "Le nom de la plateforme doit contenir au moins 2 caractères.";
    if (draft.platformName.trim().length > 60) return "Le nom de la plateforme ne peut pas dépasser 60 caractères.";
    if (!/^\d{4}-\d{4}$/.test(draft.schoolYear.trim())) return "L'année scolaire doit être au format 2026-2027.";
    if (!isValidEmail(draft.supportEmail)) return "L'adresse e-mail du support est invalide.";
    if (draft.supportPhone.trim() && !isValidSnPhone(draft.supportPhone)) return "Le téléphone du support est invalide (format 7X XXX XX XX).";
    if (draft.maintenanceMode && !draft.maintenanceMessage.trim()) return "Renseignez un message de maintenance : il sera affiché aux établissements.";
    if (draft.maintenanceMessage.length > 300) return "Le message de maintenance ne peut pas dépasser 300 caractères.";
    if (!Number.isInteger(draft.sessionTimeoutMinutes) || draft.sessionTimeoutMinutes < 5 || draft.sessionTimeoutMinutes > 480) {
      return "Le délai de déconnexion doit être compris entre 5 et 480 minutes.";
    }
    if (!Number.isInteger(draft.auditRetentionDays) || draft.auditRetentionDays < 30 || draft.auditRetentionDays > 3650) {
      return "La durée de conservation doit être comprise entre 30 et 3 650 jours.";
    }
    return null;
  };

  const save = async () => {
    setError("");
    setNotice("");
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      const res = await updateAdminSettings(draft);
      setDraft(res.settings);
      state.setData((current) =>
        current
          ? { ...current, settings: res.settings, updatedAt: res.updatedAt, updatedByName: res.updatedByName }
          : current,
      );
      await refresh();
      setNotice(
        draft.maintenanceMode
          ? "Paramètres enregistrés. Le bandeau de maintenance est désormais visible par les établissements."
          : "Paramètres enregistrés. Les changements sont immédiatement appliqués à la plateforme.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'enregistrement a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(SQL_FILE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Impossible de copier automatiquement. Le fichier est : " + SQL_FILE);
    }
  };

  const purge = async () => {
    setPurging(true);
    setError("");
    try {
      const res = await purgeAdminAudit(draft.auditRetentionDays);
      setPurgeOpen(false);
      setNotice(res.message);
      state.reload();
    } catch (e) {
      setPurgeOpen(false);
      setError(e instanceof Error ? e.message : "La purge a échoué.");
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          dark
          icon="how_to_reg"
          label="Inscriptions publiques"
          value={draft.registrationOpen ? "Ouvertes" : "Fermées"}
          note={draft.registrationOpen ? "Les directeurs peuvent créer un compte" : "Aucune nouvelle école ne peut s'inscrire"}
        />
        <StatCard
          icon="construction"
          label="Mode maintenance"
          value={draft.maintenanceMode ? "Actif" : "Inactif"}
          note={draft.maintenanceMode ? "Bandeau affiché sur l'application" : "Aucune interruption annoncée"}
        />
        <StatCard icon="timer" label="Déconnexion admin" value={`${draft.sessionTimeoutMinutes} min`} note="Après inactivité dans la console" />
        <StatCard icon="history" label="Conservation audit" value={`${draft.auditRetentionDays} j`} note="Durée par défaut avant purge" />
      </div>

      {!data.migrationApplied && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-start">
          <Icon name="database" fill className="mt-0.5 text-[22px] text-amber-700" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">La table de paramètres n'existe pas encore en production.</p>
            <p className="mt-1 leading-relaxed">
              Les valeurs ci-dessous sont les valeurs par défaut du code (lecture seule). Pour activer l'enregistrement, exécutez la
              migration dans le SQL Editor Supabase :
            </p>
            <code className="mt-2 block break-all rounded-lg bg-white/70 px-3 py-2 font-mono text-xs">{SQL_FILE}</code>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" icon={copied ? "check" : "content_copy"} onClick={copyPath}>
                {copied ? "Chemin copié" : "Copier le chemin"}
              </Button>
              <Button size="sm" variant="outline" icon="refresh" onClick={() => state.reload()}>
                Vérifier à nouveau
              </Button>
              <LinkButton to="/admin/supervision/audit" size="sm" variant="ghost" icon="history">
                Voir le journal
              </LinkButton>
            </div>
          </div>
        </div>
      )}

      {!data.canEdit && (
        <div className="flex items-start gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <Icon name="lock" fill className="mt-0.5 text-[20px] text-sky-700" />
          <span>Seul un superadministrateur peut modifier ces paramètres. La lecture reste disponible pour tous les agents.</span>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          <Icon name="check_circle" fill className="mt-0.5 text-[20px] text-emerald-600" />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Fermer le message" className="text-emerald-700">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-danger" role="alert">
          <Icon name="error" fill className="mt-0.5 text-[20px]" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Fermer le message" className="text-danger">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Identité de la plateforme" subtitle="Nom affiché dans la console et l'espace public." />
          <div className="space-y-4">
            <Input
              label="Nom de la plateforme"
              required
              value={draft.platformName}
              onChange={(e) => update("platformName", e.target.value)}
              disabled={locked}
              maxLength={60}
              hint="Affiché dans la barre supérieure et les communications."
            />
            <Input
              label="Année scolaire en cours"
              required
              value={draft.schoolYear}
              onChange={(e) => update("schoolYear", e.target.value)}
              disabled={locked}
              placeholder="2026-2027"
              hint="Format AAAA-AAAA. Utilisée pour les inscriptions et les documents."
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Support" subtitle="Coordonnées affichées aux établissements." />
          <div className="space-y-4">
            <Input
              label="E-mail du support"
              type="email"
              required
              value={draft.supportEmail}
              onChange={(e) => update("supportEmail", e.target.value)}
              disabled={locked}
              icon="mail"
            />
            <Input
              label="Téléphone du support"
              value={draft.supportPhone}
              onChange={(e) => update("supportPhone", e.target.value)}
              disabled={locked}
              icon="call"
              placeholder="77 000 00 00"
              hint="Format sénégalais : 7X XXX XX XX. Laissez vide pour masquer."
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Inscriptions & maintenance" subtitle="Ces interrupteurs agissent immédiatement sur l'accès des écoles." />
          <div className="space-y-5">
            <Switch
              id="registration-open"
              label="Inscriptions ouvertes"
              description="Autorise la création de nouveaux comptes directeurs. Fermé, le formulaire d'inscription est bloqué côté serveur."
              checked={draft.registrationOpen}
              onChange={(value) => update("registrationOpen", value)}
              disabled={locked}
            />
            <Switch
              id="maintenance-mode"
              label="Mode maintenance"
              description="Affiche un bandeau aux écoles connectées et ferme aussi les inscriptions. La console admin reste accessible."
              checked={draft.maintenanceMode}
              onChange={(value) => update("maintenanceMode", value)}
              disabled={locked}
            />
            <Textarea
              label="Message de maintenance"
              value={draft.maintenanceMessage}
              onChange={(e) => update("maintenanceMessage", e.target.value)}
              disabled={locked}
              maxLength={300}
              placeholder="Ex. Une mise à jour est en cours. Le service sera rétabli avant 18 h."
              hint={`${draft.maintenanceMessage.length}/300 caractères. Obligatoire lorsque la maintenance est active.`}
            />
            {draft.maintenanceMode && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">Aperçu du bandeau</p>
                <div className="mt-2 flex items-start gap-2 text-sm text-amber-950">
                  <Icon name="construction" fill className="mt-0.5 text-[20px] text-amber-700" />
                  <span>{draft.maintenanceMessage.trim() || "Renseignez un message pour prévisualiser le bandeau."}</span>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Sessions & journal d'audit" subtitle="Sécurité de la console et conservation des traces." />
          <div className="space-y-4">
            <Input
              label="Déconnexion automatique après inactivité (minutes)"
              type="number"
              min={5}
              max={480}
              required
              value={draft.sessionTimeoutMinutes}
              onChange={(e) => update("sessionTimeoutMinutes", Number(e.target.value))}
              disabled={locked}
              hint="Entre 5 et 480 minutes. Appliqué à la console d'administration."
            />
            <Input
              label="Conservation du journal d'audit (jours)"
              type="number"
              min={30}
              max={3650}
              required
              value={draft.auditRetentionDays}
              onChange={(e) => update("auditRetentionDays", Number(e.target.value))}
              disabled={locked}
              hint="Entre 30 et 3 650 jours. Sert de valeur par défaut à la purge."
            />
            {data.canEdit && (
              <div className="rounded-2xl border border-red-100 bg-red-50/60 p-3">
                <p className="text-sm font-semibold text-ink">Purger le journal maintenant</p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                  Supprime définitivement les événements antérieurs à la durée de conservation enregistrée. L'opération est elle-même
                  journalisée.
                </p>
                <Button className="mt-3" size="sm" variant="danger" icon="delete_sweep" onClick={() => setPurgeOpen(true)} disabled={busy || purging}>
                  Purger les événements anciens
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Effets concrets de ces réglages" subtitle="Chaque paramètre est appliqué par le serveur, sans redéploiement." />
          <ul className="grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
            <Effect icon="how_to_reg" text={draft.registrationOpen ? "Les inscriptions directeurs sont ouvertes." : "Les inscriptions directeurs sont refusées par l'API."} />
            <Effect icon="construction" text={draft.maintenanceMode ? "Un bandeau de maintenance est affiché aux écoles." : "Aucun bandeau de maintenance n'est affiché."} />
            <Effect icon="timer" text={`La console admin se déconnecte après ${draft.sessionTimeoutMinutes} min d'inactivité.`} />
            <Effect icon="history" text={`La purge propose ${draft.auditRetentionDays} jours de conservation.`} />
            <Effect icon="badge" text={`Le nom « ${draft.platformName} » est utilisé dans la console.`} />
            <Effect icon="mail" text={`Le support est joignable à ${draft.supportEmail}.`} />
          </ul>
        </Card>

        <Card>
          <CardHeader title="Traçabilité" />
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Dernière modification</dt>
              <dd className="mt-0.5 text-ink">{data.updatedAt ? formatDateTime(data.updatedAt) : "Valeurs par défaut du code"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Auteur</dt>
              <dd className="mt-0.5 text-ink">{data.updatedByName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Table de stockage</dt>
              <dd className="mt-0.5">
                <Badge tone={data.migrationApplied ? "success" : "warning"}>{data.migrationApplied ? "platform_settings active" : "Migration en attente"}</Badge>
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-neutral-500">
            Chaque enregistrement est journalisé (<code>platform_settings_updated</code>) avec l'auteur et les champs modifiés.
          </p>
        </Card>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-100 bg-white/95 p-4 shadow-soft backdrop-blur">
        <div className="flex items-center gap-2 text-sm">
          <span className={cn("size-2 rounded-full", dirty ? "bg-amber-500" : "bg-emerald-500")} />
          <span className="font-medium text-neutral-700">
            {dirty ? "Modifications non enregistrées" : data.migrationApplied ? "Tous les paramètres sont à jour" : "Mode lecture seule"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            icon="undo"
            onClick={() => {
              setDraft(data.settings);
              setError("");
              setNotice("");
            }}
            disabled={!dirty || busy}
          >
            Annuler les changements
          </Button>
          <Button icon="save" onClick={save} loading={busy} disabled={!dirty || locked}>
            Enregistrer
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={purgeOpen}
        title="Purger le journal d'audit"
        message={`Les événements antérieurs à ${draft.auditRetentionDays} jours seront supprimés définitivement. L'opération sera elle-même journalisée.`}
        confirmLabel="Purger"
        loading={purging}
        onConfirm={purge}
        onCancel={() => setPurgeOpen(false)}
      />
    </div>
  );
}

function Effect({ icon, text }: { icon: string; text: string }) {
  return (
    <li className="flex items-start gap-2 rounded-xl bg-mist px-3 py-2">
      <Icon name={icon} className="mt-0.5 text-[18px] text-forest" />
      <span>{text}</span>
    </li>
  );
}
