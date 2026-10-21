import type { TeacherContextItem } from "@/hooks/useTeacherAssignments";
import { Icon } from "./Icon";

interface Props {
  contexts: TeacherContextItem[];
  value: string | undefined;
  onChange: (key: string) => void;
  className?: string;
  id?: string;
}

/** Sélecteur de contexte « Classe · Matière » (professeur). */
export function ContextSwitcher({ contexts, value, onChange, className, id = "ctx-switcher" }: Props) {
  if (contexts.length === 0) return null;
  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">
        Classe et matière actives
      </label>
      <div className="relative">
        <Icon name="school" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-forest" />
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-11 w-full appearance-none rounded-full border border-forest/15 bg-lime-soft py-2 pl-11 pr-10 text-sm font-semibold text-forest focus:outline-none focus:ring-4 focus:ring-lime/60"
        >
          {contexts.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <Icon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-forest" />
      </div>
    </div>
  );
}
