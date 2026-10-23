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
          "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-xs leading-relaxed text-neutral-700 transition-colors sm:text-sm",
          error ? "border-danger bg-red-50" : "border-neutral-200 bg-white hover:border-forest/30",
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 size-4 shrink-0 accent-forest"
        />
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
