import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { SchoolMark } from "@/components/ui/Brand";
import type { School } from "@/types";
import { verifyMatricule } from "@/services/schoolService";
import { CHILD_CODE_LENGTH, formatMatriculeInput, isValidMatricule, MATRICULE_LENGTH } from "@/utils/matricule";

type State = "idle" | "checking" | "found" | "error";

interface Props {
  initial?: string;
  onFound: (school: School) => void;
  onBack?: () => void;
}

/**
 * ÉTAPE 1 élève / parent : saisie du matricule d'école.
 * Majuscules automatiques, espaces et tirets tolérés, vérification instantanée.
 */
export function MatriculeStep({ initial = "", onFound, onBack }: Props) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<State>("idle");
  const [school, setSchool] = useState<School | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const check = async (raw: string) => {
    const code = formatMatriculeInput(raw);
    if (!isValidMatricule(code)) {
      setState(code ? "error" : "idle");
      setError(code ? `Il manque ${MATRICULE_LENGTH - code.length} caractère(s).` : null);
      return;
    }
    setState("checking");
    setError(null);
    const result = await verifyMatricule(code);
    if (result.ok && result.school) {
      setSchool(result.school);
      setState("found");
    } else {
      setSchool(null);
      setState("error");
      setError(result.message ?? "Matricule introuvable.");
    }
  };

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (isValidMatricule(value)) timer.current = window.setTimeout(() => void check(value), 400);
    else {
      setState(value ? "error" : "idle");
      setSchool(null);
    }
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold text-ink">Matricule de votre école</h2>
        <p className="mt-1 text-sm text-neutral-600">
          L'école vous a communiqué un code de {MATRICULE_LENGTH} caractères. Collez-le ici, même depuis WhatsApp.
        </p>
      </div>
      <Input
        label="Matricule de l'école"
        required
        autoFocus
        icon="key"
        inputMode="text"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="X7K9Q"
        value={value}
        maxLength={MATRICULE_LENGTH + 3}
        onChange={(e) => setValue(formatMatriculeInput(e.target.value))}
        error={state === "error" ? error : null}
        hint="5 caractères, sans 0, O, 1 ni I."
      />
      {state === "checking" && (
        <p role="status" className="flex items-center gap-2 text-sm font-medium text-forest">
          <span className="size-4 animate-spin rounded-full border-2 border-forest border-t-transparent" />
          Vérification du matricule…
        </p>
      )}
      {state === "found" && school && (
        <div className="animate-page rounded-2xl border-2 border-leaf bg-lime-pale p-5">
          <div className="flex items-center gap-4">
            <SchoolMark name={school.name} matricule={school.matricule} size={52} />
          </div>
          <p className="mt-3 text-sm font-semibold text-forest">
            {school.city} · {school.cycles.length} cycle(s) · matricule vérifié
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="dark" icon="how_to_reg" onClick={() => onFound(school)}>
              C'est mon école
            </Button>
            <Button variant="ghost" onClick={() => { setValue(""); setSchool(null); setState("idle"); }}>
              Changer de matricule
            </Button>
          </div>
        </div>
      )}
      {state === "error" && !school && (
        <p className="flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm font-medium text-danger">
          <Icon name="error" className="text-[20px]" />
          {error}
        </p>
      )}
      {onBack && (
        <Button variant="ghost" icon="arrow_back" onClick={onBack}>
          Changer de rôle
        </Button>
      )}
    </Card>
  );
}

/** Saisie du code élève à 6 caractères (étape 2 du parent). */
export function ChildCodeInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string | null }) {
  return (
    <Input
      label="Code élève"
      required
      icon="confirmation_number"
      inputMode="text"
      autoCapitalize="characters"
      spellCheck={false}
      placeholder="K4M2P7"
      value={value}
      maxLength={CHILD_CODE_LENGTH + 2}
      onChange={(e) => onChange(formatMatriculeInput(e.target.value, CHILD_CODE_LENGTH))}
      error={error}
      hint="Code à 6 caractères donné par l'école pour chaque enfant."
    />
  );
}