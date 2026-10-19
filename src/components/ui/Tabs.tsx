import { cn } from "@/utils/cn";
import { Icon } from "./Icon";

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: string | number;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  className?: string;
}

export function Tabs({ items, value, onChange, label, className }: TabsProps) {
  return (
    <div role="tablist" aria-label={label} className={cn("no-scrollbar flex gap-2 overflow-x-auto pb-1", className)}>
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-all",
              active ? "bg-forest text-white shadow-card" : "bg-white text-forest hover:bg-lime-soft",
            )}
          >
            {t.icon && <Icon name={t.icon} className="text-[18px]" />}
            {t.label}
            {t.badge !== undefined && <span className={cn("rounded-full px-2 py-0.5 text-xs", active ? "bg-lime text-forest" : "bg-mist text-neutral-600")}>{t.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
