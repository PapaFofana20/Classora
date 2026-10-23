import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

/** Mot mis en valeur : italique Fraunces, cadre de sélection avec poignées (style de la référence). */
export function Highlight({ children, dark, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <span className={cn("relative mx-1 inline-block px-2 font-serif font-semibold italic", dark ? "bg-lime/20 text-lime" : "bg-lime/50 text-forest", className)}>
      <span className={cn("absolute inset-y-0 left-0 w-px", dark ? "bg-lime" : "bg-leaf")} aria-hidden="true" />
      <span className={cn("absolute inset-y-0 right-0 w-px", dark ? "bg-lime" : "bg-leaf")} aria-hidden="true" />
      <span className={cn("absolute -left-[3px] -top-[3px] size-[7px] rounded-full", dark ? "bg-lime" : "bg-leaf")} aria-hidden="true" />
      <span className={cn("absolute -bottom-[3px] -right-[3px] size-[7px] rounded-full", dark ? "bg-lime" : "bg-leaf")} aria-hidden="true" />
      {children}
    </span>
  );
}
