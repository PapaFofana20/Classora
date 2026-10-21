import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/context/ToastContext";
import { toggleRegistration } from "@/services/schoolService";
import type { School } from "@/types";
import { MATRICULE_ALPHABET, MATRICULE_LENGTH } from "@/utils/matricule";

/** Lien d'inscription pré-rempli avec le matricule. */
export function signupLink(matricule: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}inscription?matricule=${matricule}`;
}

/** Message WhatsApp prêt à envoyer aux familles. */
export function whatsappMessage(school: School): string {
  return [
    `Bonjour 👋`,
    `Les inscriptions sont ouvertes à *${school.name}* (${school.city}).`,
    ``,
    `Inscrivez-vous en 2 minutes depuis votre téléphone :`,
    signupLink(school.matricule),
    ``,
    `Matricule de l'école : *${school.matricule}*`,
  ].join("\n");
}

interface Props {
  school: School;
  canManage?: boolean;
  onChanged?: () => void;
}

/**
 * Carte « Matricule de votre école » : visible en permanence dans le tableau de
 * bord du directeur, copiable en un clic.
 * (QR code volontairement omis : aucune dépendance ajoutée — voir SUPABASE_NOTES.md)
 */
export function MatriculeCard({ school, canManage = false, onChanged }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const copy = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(message);
    } catch {
      toast("Copie impossible sur cet appareil. Notez le matricule manuellement.", "error");
    }
  };

  const share = async () => {
    const url = signupLink(school.matricule);
    const text = whatsappMessage(school);
    if (navigator.share) {
      try {
        await navigator.share({ title: `Inscription — ${school.name}`, text, url });
        return;
      } catch {
        /* partage annulé : on retombe sur la copie */
      }
    }
    await copy(`${text}\n${url}`, "Lien et message copiés : collez-les dans WhatsApp.");
  };

  const toggle = async (open: boolean) => {
    setBusy(true);
    try {
      await toggleRegistration(school.id, open);
      toast(open ? "Inscriptions ouvertes." : "Inscriptions fermées : le matricule est désactivé temporairement.");
      onChanged?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Modification impossible.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Matricule de votre école"
        subtitle="Communiqué aux élèves et aux parents pour créer leur compte. Il ne change jamais."
        action={<Badge tone={school.registrationOpen ? "success" : "warning"}>{school.registrationOpen ? "Inscriptions ouvertes" : "Inscriptions fermées"}</Badge>}
      />
      <div className="flex flex-wrap items-center gap-4">
        <p className="rounded-2xl bg-forest px-5 py-3 text-3xl font-extrabold tracking-[0.35em] text-lime sm:text-4xl" aria-label={`Matricule ${school.matricule.split("").join(" ")}`}>
          {school.matricule}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button icon="content_copy" variant="outline" onClick={() => void copy(school.matricule, "Matricule copié.")}>
            Copier
          </Button>
          <Button icon="share" variant="dark" onClick={() => void share()}>
            Partager
          </Button>
        </div>
      </div>
      <div className="mt-5 space-y-4 rounded-2xl bg-mist p-4">
        <div className="flex items-start gap-3 text-sm text-neutral-700">
          <Icon name="link" className="text-[20px] text-forest" />
          <span className="min-w-0">
            <span className="block font-semibold">Lien d'inscription pré-rempli</span>
            <span className="block truncate text-neutral-500">{signupLink(school.matricule)}</span>
          </span>
        </div>
        <div className="flex items-start gap-3 text-sm text-neutral-700">
          <Icon name="chat" className="text-[20px] text-leaf" />
          <span className="min-w-0">
            <span className="block font-semibold">Message WhatsApp prêt à envoyer</span>
            <span className="block text-xs text-neutral-500">Bouton « Partager » → il ouvre WhatsApp avec ce message.</span>
          </span>
        </div>
        {canManage && (
          <div className="border-t border-neutral-200 pt-4">
            <Switch
              id="registration-open"
              checked={school.registrationOpen}
              disabled={busy}
              onChange={(v) => void toggle(v)}
              label="Inscriptions en ligne"
              description={`Désactiver : les élèves et parents verront « ${school.name} n'accepte pas de nouvelles inscriptions ». Le matricule est conservé.`}
            />
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        {MATRICULE_LENGTH} caractères parmi {MATRICULE_ALPHABET} (sans 0, O, 1 ni I pour éviter les confusions).
      </p>
    </Card>
  );
}