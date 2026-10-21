import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TempPasswordField } from "@/features/auth/PasswordField";
import type { StaffRole } from "@/types";
import { STAFF_ROLE_LABELS, STAFF_ROLES } from "@/utils/permissions";
import { generateTempPassword } from "@/utils/password";
import { isValidEmail, isValidSnPhone } from "@/utils/format";
import { cn } from "@/utils/cn";

export interface StaffFormValue {
  role: StaffRole;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialties: string[];
  tempPassword: string;
}

interface Props {
  subjects: { id: string; name: string }[];
  initial?: Partial<StaffFormValue>;
  onSubmit: (value: StaffFormValue) => Promise<void> | void;
  submitLabel: string;
  busy?: boolean;
  onCancel?: () => void;
}

const EMPTY: StaffFormValue = { role: "professeur", firstName: "", lastName: "", email: "", phone: "", specialties: [], tempPassword: "" };

/** Formulaire de création / modification d'un accès enseignant (directeur uniquement). */
export function StaffForm({ subjects, initial, onSubmit, submitLabel, busy, onCancel }: Props) {
  const [form, setForm] = useState<StaffFormValue>({ ...EMPTY, ...initial });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const errors = {
    firstName: form.firstName.trim().length < 2 ? "Le prénom est obligatoire." : null,
    lastName: form.lastName.trim().length < 2 ? "Le nom est obligatoire." : null,
    email: !isValidEmail(form.email) ? "Saisissez une adresse e-mail valide." : null,
    phone: !isValidSnPhone(form.phone) ? "Format attendu : 77 123 45 67." : null,
    tempPassword: initial?.tempPassword ? null : form.tempPassword.length < 8 ? "Générez un mot de passe temporaire (8 caractères minimum)." : null,
    specialties: form.role === "professeur" && form.specialties.length === 0 ? "Choisissez au moins une matière." : null,
  };
  const valid = Object.values(errors).every((e) => e === null);
  const show = (key: keyof typeof errors) => (touched[key] ? errors[key] : null);
  const touch = (key: string) => setTouched((t) => ({ ...t, [key]: true }));

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(Object.keys(errors).reduce((acc, k) => ({ ...acc, [k]: true }), {}));
        if (valid) void onSubmit(form);
      }}
      aria-label="Formulaire d'accès enseignant"
    >
      <Select label="Rôle" required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })} options={STAFF_ROLES.map((r) => ({ value: r, label: STAFF_ROLE_LABELS[r] }))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Prénom" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} onBlur={() => touch("firstName")} error={show("firstName")} />
        <Input label="Nom" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} onBlur={() => touch("lastName")} error={show("lastName")} />
        <Input label="Adresse e-mail" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} onBlur={() => touch("email")} error={show("email")} />
        <Input label="Téléphone" type="tel" required placeholder="77 123 45 67" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} onBlur={() => touch("phone")} error={show("phone")} />
      </div>
      {form.role === "professeur" && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Matières enseignées</legend>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => {
              const on = form.specialties.includes(s.id);
              return (
                <label key={s.id} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium", on ? "border-forest bg-lime" : "border-neutral-200")}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => setForm({ ...form, specialties: on ? form.specialties.filter((x) => x !== s.id) : [...form.specialties, s.id] })} />
                  {s.name}
                </label>
              );
            })}
          </div>
          {form.specialties.length === 0 && <p className="mt-2 text-xs font-medium text-danger">Choisissez au moins une matière.</p>}
        </fieldset>
      )}
      {!initial?.tempPassword && (
        <div className="rounded-2xl bg-mist p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Mot de passe temporaire</p>
            <Button size="sm" variant="outline" icon="auto_awesome" onClick={() => setForm({ ...form, tempPassword: generateTempPassword() })}>
              Générer
            </Button>
          </div>
          <TempPasswordField value={form.tempPassword} onChange={(v) => setForm({ ...form, tempPassword: v })} />
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="ghost" icon="content_copy" disabled={!form.tempPassword} onClick={() => void navigator.clipboard.writeText(form.tempPassword)}>
              Copier
            </Button>
          </div>
          {form.tempPassword && <p className="mt-2 flex items-start gap-2 text-xs text-neutral-600"><Icon name="info" className="text-[16px]" />Ce mot de passe n'est affiché qu'une seule fois : copiez-le ou envoyez-le par WhatsApp.</p>}
        </div>
      )}
      <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
        )}
        <Button type="submit" variant="dark" loading={busy} disabled={!valid}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}