import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { cn } from "@/utils/cn";
import { PASSWORD_RULES, passwordStrength } from "@/utils/password";

interface Props {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  showStrength?: boolean;
  autoComplete?: string;
  id?: string;
  hint?: string;
}

/** Champ mot de passe : règles lisibles, force, afficher/masquer, copier. */
export function PasswordField({ label = "Mot de passe", value, onChange, error, showStrength = true, autoComplete = "new-password", id, hint }: Props) {
  const [show, setShow] = useState(false);
  const strength = passwordStrength(value);

  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          label={label}
          required
          type={show ? "text" : "password"}
          icon="lock"
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={error}
          hint={hint}
        />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-1 top-[29px] grid size-11 place-items-center rounded-full text-forest/70 hover:bg-mist">
          <Icon name={show ? "visibility_off" : "visibility"} className="text-[20px]" />
        </button>
      </div>
      {showStrength && (
        <div className={cn(value.length > 0 ? "mt-2" : "mt-1.5")}>
          {value.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
                <div className={cn("h-full rounded-full transition-[width,background-color] duration-300", strength.strength === "faible" ? "bg-danger" : strength.strength === "moyen" ? "bg-amber-500" : "bg-leaf")} style={{ width: `${(strength.score / PASSWORD_RULES.length) * 100}%` }} />
              </div>
              <span className="text-xs font-semibold text-neutral-500">{strength.label}</span>
            </div>
          )}
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {PASSWORD_RULES.map((r) => {
              const ok = strength.satisfied.includes(r.id);
              return (
                <li key={r.id} className={cn("flex items-center gap-1", ok ? "text-leaf" : "text-neutral-400")}>
                  <Icon name={ok ? "check_circle" : "radio_button_unchecked"} className="text-[14px]" />
                  {r.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Champ mot de passe temporaire : affichage / copie / génération. */
export function TempPasswordField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="relative">
        <Input
          label="Mot de passe temporaire"
          icon="key"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text").trim();
            if (text) {
              e.preventDefault();
              onChange(text);
            }
          }}
          hint=" Communiqué à l'enseignant : il devra le changer à sa première connexion."
        />
        <div className="absolute right-1 top-[29px] flex gap-1">
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="grid size-11 place-items-center rounded-full text-forest/70 hover:bg-mist">
            <Icon name={show ? "visibility_off" : "visibility"} className="text-[20px]" />
          </button>
        </div>
      </div>
      <p className={cn("mt-2 rounded-xl bg-mist px-3 py-2 text-center font-mono text-lg tracking-widest", !show && "select-none blur-[3px]")}>{value || "—"}</p>
    </div>
  );
}