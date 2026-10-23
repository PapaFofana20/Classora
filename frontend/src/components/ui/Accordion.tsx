import { useId, useState } from "react";
import { cn } from "@/utils/cn";
import { Icon } from "./Icon";

interface Item {
  q: string;
  a: string;
}

export function Accordion({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  return (
    <div className="space-y-3">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={it.q} className={cn("rounded-2xl border transition-colors", isOpen ? "border-forest/20 bg-lime-pale" : "border-neutral-200 bg-white")}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${base}-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-3 text-left text-sm font-semibold text-ink sm:text-base"
              >
                {it.q}
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full transition-transform duration-300", isOpen ? "rotate-45 bg-forest text-lime" : "bg-mist text-forest")}>
                  <Icon name="add" className="text-[20px]" />
                </span>
              </button>
            </h3>
            <div id={`${base}-${i}`} role="region" className={cn("overflow-hidden transition-[max-height] duration-300 ease-out", isOpen ? "max-h-96" : "max-h-0")}>
              <div>
                <p className="px-5 pb-5 text-sm leading-relaxed text-neutral-600">{it.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
