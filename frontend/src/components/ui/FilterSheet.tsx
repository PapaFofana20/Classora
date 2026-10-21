import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useModalBehavior } from "@/hooks/useModalBehavior";
import { Icon } from "./Icon";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function FilterSheet({ open, onClose, title = "Filtres", children, footer }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalBehavior(open, onClose, panelRef);

  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (media.matches) onClose();
    };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="no-print fixed inset-0 z-modal md:hidden" role="presentation">
      <div className="absolute inset-0 bg-forest/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="absolute inset-x-0 bottom-0 flex max-h-[85svh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-soft focus:outline-none">
        <div className="flex justify-center pt-2">
          <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-neutral-300" />
        </div>
        <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-1">
          <p className="text-lg font-extrabold text-forest">{title}</p>
          <button type="button" onClick={onClose} aria-label="Fermer les filtres" className="grid size-11 shrink-0 place-items-center rounded-full bg-mist text-forest">
            <Icon name="close" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-neutral-100 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
