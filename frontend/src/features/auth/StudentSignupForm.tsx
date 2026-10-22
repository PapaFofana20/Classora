import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SchoolMark } from "@/components/ui/Brand";
import { PasswordField } from "@/features/auth/PasswordField";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useAsync } from "@/hooks/useAsync";
import { openClassesFor } from "@/services/schoolService";
import type { School } from "@/types";
import { isValidEmail, isValidSnPhone } from "@/utils/format";
import { passwordError } from "@/utils/password";

interface Props {
  school: School;
  onBack: () => void;
}

/** ÉTAPE 2 élève : informations personnelles + classe de CETTE école. */
export function StudentSignupForm({ school, onBack }: Props) {
  const { registerStudent, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const classes = useAsync(() => openClassesFor(school.id), [school.id]);
  const [form, setForm] = useState({ firstName: "", lastName: "", gender: "F", birthDate: "", classId: "", email: "", phone: "", password: "", confirm: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const list = classes.data;
    if (list && list.length && !form.classId) setForm((f) => ({ ...f, classId: list[0].id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes.data]);

  const errors = {
    firstName: form.firstName.trim().length < 2 ? "Le prénom est obligatoire." : null,
    lastName: form.lastName.trim().length < 2 ? "Le nom est obligatoire." : null,
    birthDate: !form.birthDate ? "Date de naissance obligatoire." : null,
    classId: !form.classId ? "Choisissez la classe demandée." : null,
    email: !isValidEmail(form.email) ? "Saisissez une adresse e-mail valide." : null,
    phone: form.phone && !isValidSnPhone(form.phone) ? "Format attendu : 77 123 45 67." : null,
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
      await registerStudent({
        schoolId: school.id,
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender === "M" ? "M" : "F",
        birthDate: form.birthDate,
        classId: form.classId,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      logout();
      toast("Demande envoyée à l'école.");
      navigate("/inscription-envoyee?role=eleve", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inscription impossible.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Inscription de l'élève">
      <div className="flex items-center gap-3 rounded-2xl bg-lime-soft p-4">
        <SchoolMark name={school.name} size={40} />
        <span className="text-sm font-semibold text-forest">Inscription à {school.name}</span>
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
        <Select label="Genre" options={[{ value: "F", label: "Fille" }, { value: "M", label: "Garçon" }]} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
        <Input label="Date de naissance" required type="date" hint="Sélectionnez la date de naissance de l'élève." value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} onBlur={() => touch("birthDate")} error={show("birthDate")} />
        <Select
          label="Classe demandée"
          required
          placeholder={classes.loading ? "Chargement des classes…" : "Choisir une classe"}
          disabled={classes.loading}
          value={form.classId}
          onChange={(e) => setForm({ ...form, classId: e.target.value })}
          error={show("classId")}
          options={(classes.data ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.filled}/${c.capacity} places` }))}
        />
        <Input label="Adresse e-mail" type="email" required autoComplete="email" placeholder="vous@exemple.sn" hint="Cette adresse servira à vous connecter." value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} onBlur={() => touch("email")} error={show("email")} />
        <Input label="Téléphone (facultatif)" type="tel" placeholder="77 123 45 67" hint="Numéro sénégalais à 9 chiffres." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} onBlur={() => touch("phone")} error={show("phone")} />
        <PasswordField value={form.password} onChange={(v) => setForm({ ...form, password: v })} error={show("password")} />
        <PasswordField label="Confirmer" showStrength={false} hint="Ressaisissez le même mot de passe." value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} error={show("confirm")} />
      </div>
      <p className="flex items-start gap-2 rounded-2xl bg-mist p-4 text-xs text-neutral-600">
        <Icon name="info" className="text-[18px]" />
        Votre compte est créé immédiatement, mais l'accès à l'espace de l'école est ouvert après validation par la direction.
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