import { useEffect, useRef, useState } from "react";
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
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setEdges({ left: node.scrollLeft > 2, right: node.scrollLeft + node.clientWidth < node.scrollWidth - 2 });
    update();
    node.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [items]);

  return (
    <div className={cn("relative", className)}>
      <div ref={ref} role="tablist" aria-label={label} className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {items.map((t) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={(event) => {
                onChange(t.id);
                event.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest" });
              }}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-[background-color,color,box-shadow]",
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
      {edges.left && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-mist to-transparent" />}
      {edges.right && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-mist to-transparent" />}
    </div>
  );
}
