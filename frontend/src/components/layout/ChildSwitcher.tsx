import { useChild } from "@/context/ChildContext";
import { Icon } from "@/components/ui/Icon";

/** Sélecteur d'élève (compte parent). */
export function ChildSwitcher({ className, id = "child-switcher" }: { className?: string; id?: string }) {
  const { children, activeChild, setActiveChildId } = useChild();
  if (children.length === 0) return null;
  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">
        Élève sélectionné
      </label>
      <div className="relative">
        <Icon name="face" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-forest" />
        <select
          id={id}
          value={activeChild?.id ?? ""}
          onChange={(e) => setActiveChildId(e.target.value)}
          className="min-h-11 w-full appearance-none rounded-full border border-forest/15 bg-lime-soft py-2 pl-11 pr-10 text-sm font-semibold text-forest focus:outline-none focus:ring-4 focus:ring-lime/60"
        >
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} · {c.className}
            </option>
          ))}
        </select>
        <Icon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-forest" />
      </div>
    </div>
  );
}
