import { useId } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string | null;
}

/** Case d'acceptation obligatoire des CGU et de la Politique de confidentialité. */
export function LegalConsent({ checked, onChange, error }: Props) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-2xl border bg-lime p-4 text-xs leading-relaxed text-forest transition-colors sm:text-sm",
          error ? "border-danger" : "border-forest/15 hover:border-forest/35",
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errorId : undefined}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-forest peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-lime",
            checked ? "border-forest bg-forest text-lime" : "border-forest/40 bg-white text-transparent",
          )}
        >
          <Icon name="check" className="text-[15px]" />
        </span>
        <span>
          J'ai lu et j'accepte les{" "}
          <Link to="/cgu" target="_blank" rel="noreferrer" className="font-semibold text-forest underline underline-offset-2">
            Conditions Générales d'Utilisation
          </Link>{" "}
          et la{" "}
          <Link to="/confidentialite" target="_blank" rel="noreferrer" className="font-semibold text-forest underline underline-offset-2">
            Politique de confidentialité
          </Link>
          . J'accepte que mes données soient traitées conformément à cette politique.
        </span>
      </label>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
          <Icon name="error" className="text-[16px]" />
          {error}
        </p>
      )}
    </div>
  );
}
