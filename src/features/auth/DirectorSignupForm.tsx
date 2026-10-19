import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { PasswordField } from "@/features/auth/PasswordField";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { CYCLES, CYCLE_LABELS } from "@/data/school";
import type { Cycle } from "@/types";
import { cn } from "@/utils/cn";
import { isValidEmail, isValidSnPhone } from "@/utils/format";
import { passwordError } from "@/utils/password";

const CITIES = ["Dakar", "Thiès", "Mbour", "Saint-Louis", "Kaolack", "Ziguinchor", "Tambacounda", "Louga", "Kolda", "Kaffrine"];

/** Inscription du directeur : école + compte. Moins de 3 minutes jusqu'au matricule. */
export function DirectorSignupForm() {
  const { registerDirector } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [cycles, setCycles] = useState<Cycle[]>(["elementaire", "moyen"]);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", schoolName: "", city: "Dakar", password: "", confirm: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = {
    firstName: form.firstName.trim().length < 2 ? "Le prénom est obligatoire." : null,
    lastName: form.lastName.trim().length < 2 ? "Le nom est obligatoire." : null,
    email: !isValidEmail(form.email) ? "Saisissez une adresse e-mail valide." : null,
    phone: !isValidSnPhone(form.phone) ? "Format attendu : 77 123 45 67." : null,
    schoolName: form.schoolName.trim().length < 3 ? "Indiquez le nom de votre école." : null,
    city: form.city.trim().length < 2 ? "Indiquez la ville." : null,
    password: passwordError(form.password, form.confirm),
    confirm: form.confirm !== form.password ? "Les mots de passe ne correspondent pas." : null,
    cycles: cycles.length === 0 ? "Choisissez au moins un cycle." : null,
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
      await registerDirector({ ...form, cycles });
      toast("Compte créé. Choisissez votre formule pour obtenir votre matricule.");
      navigate("/app/abonnement", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création du compte impossible.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Inscription du directeur">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm font-medium text-danger">
          <Icon name="error" className="text-[20px]" />
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Prénom" required autoComplete="given-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} onBlur={() => touch("firstName")} error={show("firstName")} />
        <Input label="Nom" required autoComplete="family-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} onBlur={() => touch("lastName")} error={show("lastName")} />
        <Input className="sm:col-span-2" label="Nom de l'école" required icon="school" placeholder="Ex. Groupe Scolaire Les Baobabs" value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} onBlur={() => touch("schoolName")} error={show("schoolName")} />
        <Input label="Ville" required icon="location_on" list="villes" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} onBlur={() => touch("city")} error={show("city")} />
        <datalist id="villes">
          {CITIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Input label="Adresse e-mail" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} onBlur={() => touch("email")} error={show("email")} />
        <Input label="Téléphone" type="tel" required placeholder="77 123 45 67" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} onBlur={() => touch("phone")} error={show("phone")} />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Cycles proposés par votre école</legend>
        <div className="flex flex-wrap gap-2">
          {CYCLES.map((c) => {
            const on = cycles.includes(c);
            return (
              <label key={c} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium", on ? "border-forest bg-lime" : "border-neutral-200")}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => setCycles((l) => (on ? l.filter((x) => x !== c) : [...l, c]))} />
                {CYCLE_LABELS[c]}
              </label>
            );
          })}
        </div>
        {cycles.length === 0 && <p className="mt-2 text-xs font-medium text-danger">Choisissez au moins un cycle.</p>}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <PasswordField value={form.password} onChange={(v) => setForm({ ...form, password: v })} error={show("password")} />
        <PasswordField label="Confirmer" showStrength={false} value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} error={show("confirm")} />
      </div>
      <Card className="!bg-lime-soft text-sm">
        <p className="flex items-start gap-2 font-medium text-forest">
          <Icon name="workspace_premium" className="text-[20px]" />
          Étape suivante : choisissez une formule et payez (Wave, Orange Money ou Free Money). Votre matricule d'école est généré à la confirmation du paiement.
        </p>
      </Card>
      <Button type="submit" size="lg" variant="dark" className="w-full" loading={busy} disabled={busy}>
        Créer mon école
      </Button>
    </form>
  );
}