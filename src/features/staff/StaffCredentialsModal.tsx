import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import type { StaffCredentials } from "@/services/authService";
import type { School } from "@/types";

/** Lien de connexion transmis aux enseignants. */
export const connexionLink = (): string => `${window.location.origin}${window.location.pathname}#/connexion`;

interface Props {
  open: boolean;
  credentials: StaffCredentials | null;
  school: School | null;
  /** "création" ou "réinitialisation" : seul le titre change. */
  kind?: "creation" | "reset";
  onClose: () => void;
}

/** Message WhatsApp pré-rempli : lien de connexion, e-mail, mot de passe, matricule. */
export function credentialsMessage(credentials: StaffCredentials, school: School | null): string {
  const link = connexionLink();
  return [
    `Bonjour ${credentials.firstName},`,
    ``,
    `Votre accès EcoleConnect (${school?.name ?? "votre école"}) est prêt.`,
    ``,
    `🔑 Lien de connexion : ${link}`,
    `✉️ E-mail : ${credentials.email}`,
    `🔒 Mot de passe temporaire : ${credentials.tempPassword}`,
    school?.matricule ? `🏫 Matricule de l'école : ${school.matricule}` : "",
    ``,
    `À la première connexion, vous devrez choisir un nouveau mot de passe.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function textToCopy(credentials: StaffCredentials, school: School | null): string {
  return credentialsMessage(credentials, school);
}

/**
 * Modale « Accès créé » : les identifiants ne sont affichés qu'une seule fois.
 * Copier les identifiants ou envoyer par WhatsApp.
 */
export function StaffCredentialsModal({ open, credentials, school, kind = "creation", onClose }: Props) {
  if (!credentials) return null;
  const message = textToCopy(credentials, school);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${credentials.email}\n${credentials.tempPassword}`);
    } catch {
      /* presse-papiers indisponible */
    }
  };

  const whatsapp = async () => {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kind === "creation" ? "Accès créé" : "Mot de passe réinitialisé"}
      size="md"
      footer={
        <>
          <Button variant="outline" icon="print" onClick={() => window.print()}>
            Imprimer
          </Button>
          <Button variant="ghost" icon="content_copy" onClick={() => void copy()}>
            Copier les identifiants
          </Button>
          <Button variant="dark" icon="send" onClick={() => void whatsapp()}>
            Envoyer par WhatsApp
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-2xl bg-lime-soft p-4 text-sm font-medium text-forest">
          Transmettez ces identifiants à {credentials.firstName}. Ce mot de passe ne sera plus jamais affiché après la fermeture de cette fenêtre.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-mist p-4">
            <dt className="text-xs font-semibold uppercase text-neutral-500">Nom</dt>
            <dd className="mt-1 font-bold">
              {credentials.firstName} {credentials.lastName}
            </dd>
          </div>
          <div className="rounded-xl bg-mist p-4">
            <dt className="text-xs font-semibold uppercase text-neutral-500">Rôle</dt>
            <dd className="mt-1 font-bold capitalize">{credentials.role}</dd>
          </div>
          <div className="rounded-xl bg-mist p-4">
            <dt className="text-xs font-semibold uppercase text-neutral-500">E-mail</dt>
            <dd className="mt-1 break-all font-bold">{credentials.email}</dd>
          </div>
          <div className="rounded-xl bg-mist p-4">
            <dt className="text-xs font-semibold uppercase text-neutral-500">Mot de passe temporaire</dt>
            <dd className="mt-1 font-mono text-lg font-bold tracking-wider">{credentials.tempPassword}</dd>
          </div>
        </dl>
        {school?.matricule && (
          <p className="flex items-center gap-2 text-sm text-neutral-600">
            <Icon name="key" className="text-[18px] text-forest" />
            Matricule de l'école : <strong className="tracking-[0.25em]">{school.matricule}</strong>
          </p>
        )}
        <p className="text-xs text-neutral-500">Lien de connexion : {connexionLink()}</p>
        <details className="rounded-2xl border border-neutral-200 p-4">
          <summary className="cursor-pointer text-sm font-semibold">Voir le message WhatsApp prérempli</summary>
          <pre className="mt-3 whitespace-pre-wrap text-xs text-neutral-700">{message}</pre>
        </details>
      </div>
    </Modal>
  );
}