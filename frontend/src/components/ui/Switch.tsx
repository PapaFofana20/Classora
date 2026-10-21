import { cn } from "@/utils/cn";

interface Props {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

/** Interrupteur accessible (role="switch", navigable au clavier). */
export function Switch({ checked, onChange, label, description, disabled, id = "switch" }: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-sm font-semibold text-ink">
          {label}
        </label>
        {description && <span className="mt-0.5 block text-xs text-neutral-500">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
          checked ? "bg-leaf" : "bg-neutral-300",
        )}
      >
        <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}