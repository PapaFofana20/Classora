import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { SchoolMark } from "@/components/ui/Brand";
import { ChildCodeInput } from "@/features/auth/MatriculeStep";
import { PasswordField } from "@/features/auth/PasswordField";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { CHILD_CODE_LENGTH } from "@/utils/matricule";
import type { School } from "@/types";
import { isValidEmail, isValidSnPhone } from "@/utils/format";
import { passwordError } from "@/utils/password";

interface Props {
  school: School;
  onBack: () => void;
}

/** ÉTAPE 2 parent : identité + code élève fourni par l'école. */
export function ParentSignupForm({ school, onBack }: Props) {
  const { registerParent, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", childCode: "", password: "", confirm: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = {
    firstName: form.firstName.trim().length < 2 ? "Le prénom est obligatoire." : null,
    lastName: form.lastName.trim().length < 2 ? "Le nom est obligatoire." : null,
    phone: !isValidSnPhone(form.phone) ? "Format attendu : 77 123 45 67." : null,
    email: !isValidEmail(form.email) ? "Saisissez une adresse e-mail valide." : null,
    childCode: form.childCode.length !== CHILD_CODE_LENGTH ? `Le code comporte ${CHILD_CODE_LENGTH} caractères.` : null,
    password: passwordError(form.password, form.confirm),
    confirm: form.confirm !== form.password ? "Les mots de passe ne correspondent pas." : null,
  };
  const valid = Object.values(errors).every((e) => e === null);
  const show = (key: keyof typeof errors) => (touched[key] ? errors[key] : null);
  const touch = (key: string) => setTouched((t) => ({ ...t, [key]: true }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(Object.keys(errors).reduce((acc, k) => ({ ...acc, [k]: true }), {}));
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const { childName } = await registerParent({ schoolId: school.id, ...form });
      logout();
      toast("Demande envoyée à l'école.");
      navigate(`/inscription-envoyee?role=parent&enfant=${encodeURIComponent(childName)}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inscription impossible.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Inscription du parent">
      <div className="flex items-center gap-3 rounded-2xl bg-lime-soft p-4">
        <SchoolMark name={school.name} size={40} />
        <span className="text-sm font-semibold text-forest">Espace parent · {school.name}</span>
      </div>
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm font-medium text-danger">
          <Icon name="error" className="text-[20px]" />
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Prénom" required autoComplete="given-name" placeholder="Ex. Aminata" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} onBlur={() => touch("firstName")} error={show("firstName")} />
        <Input label="Nom" required autoComplete="family-name" placeholder="Ex. Diop" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} onBlur={() => touch("lastName")} error={show("lastName")} />
      </div>
      <div className="grid gap-4">
        <Input label="Téléphone" type="tel" required placeholder="77 123 45 67" autoComplete="tel" hint="Numéro sénégalais à 9 chiffres." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} onBlur={() => touch("phone")} error={show("phone")} />
        <Input label="Adresse e-mail" type="email" required autoComplete="email" placeholder="vous@exemple.sn" hint="Cette adresse servira à vous connecter." value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} onBlur={() => touch("email")} error={show("email")} />
        <ChildCodeInput value={form.childCode} onChange={(v) => setForm({ ...form, childCode: v })} error={form.childCode ? show("childCode") : null} />
        <PasswordField value={form.password} onChange={(v) => setForm({ ...form, password: v })} error={show("password")} />
        <PasswordField label="Confirmer" showStrength={false} hint="Ressaisissez le même mot de passe." value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} error={show("confirm")} />
      </div>
      <p className="flex items-start gap-2 rounded-2xl bg-mist p-4 text-xs text-neutral-600">
        <Icon name="family_restroom" className="text-[18px]" />
        Le code élève permet de rattacher votre compte à votre enfant dans cette école. Vous pourrez ajouter d'autres enfants depuis votre espace.
      </p>
      <div className="flex gap-3">
        <Button type="button" variant="outline" size="lg" onClick={onBack} disabled={busy}>
          Retour
        </Button>
        <Button type="submit" size="lg" variant="dark" className="flex-1" loading={busy}>
          Envoyer ma demande
        </Button>
      </div>
    </form>
  );
}