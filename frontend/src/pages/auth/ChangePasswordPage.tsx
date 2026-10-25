import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { PasswordField } from "@/features/auth/PasswordField";
import { useAuth } from "@/context/AuthContext";
import { useSchool } from "@/context/SchoolContext";
import { useToast } from "@/context/ToastContext";
import { passwordError } from "@/utils/password";
import { usePageMeta } from "@/hooks/usePageMeta";

/** /app/mot-de-passe-temporaire — changement obligatoire à la première connexion. */
export default function ChangePasswordPage() {
  const { user, changePassword } = useAuth();
  const school = useSchool();
  const { toast } = useToast();
  const navigate = useNavigate();
  usePageMeta({ title: "Changement de mot de passe", noindex: true });
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user?.mustChangePassword) {
    navigate("/app", { replace: true });
    return null;
  }

  const currentErr = form.current ? "Mot de passe incorrect (utilisez celui reçu de la direction)." : null;
  const nextErr = form.next ? passwordError(form.next, form.confirm) : null;
  const confirmErr = form.confirm && form.confirm !== form.next ? "Les mots de passe ne correspondent pas." : null;
  const valid = form.current.length > 0 && passwordError(form.next, form.confirm) === null;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await changePassword(form.current, form.next);
      toast("Mot de passe mis à jour. Bonne journée !");
      navigate("/app", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Changement impossible.");
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Choisissez votre mot de passe" subtitle={`Accès ${school.schoolName} · obligatoire avant d'entrer dans l'application.`} />
      <div className="mx-auto max-w-xl">
        <Card className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            <Icon name="key" className="text-[20px]" />
            <p>Votre mot de passe temporaire a été défini par la direction de votre école. Par sécurité, remplacez-le maintenant : il ne sera plus jamais affiché.</p>
          </div>
          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <PasswordField label="Mot de passe temporaire" showStrength={false} autoComplete="current-password" hint="Le mot de passe communiqué par la direction de votre école." value={form.current} onChange={(v) => setForm({ ...form, current: v })} error={currentErr} />
          <PasswordField label="Nouveau mot de passe" value={form.next} onChange={(v) => setForm({ ...form, next: v })} error={nextErr} />
          <PasswordField label="Confirmer le nouveau mot de passe" showStrength={false} hint="Ressaisissez le nouveau mot de passe." value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} error={confirmErr} />
          <Button className="w-full" size="lg" variant="dark" icon="lock" loading={busy} disabled={!valid} onClick={() => void submit()}>
            Enregistrer et continuer
          </Button>
        </Card>
      </div>
    </>
  );
}