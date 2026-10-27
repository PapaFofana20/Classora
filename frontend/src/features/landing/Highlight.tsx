import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

/**
 * Mot mis en valeur : italique Fraunces sur fond doux. L'ancien cadre de
 * « sélection » (barres latérales + poignées rondes) donnait l'impression
 * que le mot était en cours de copie — il a été retiré sur toute l'app.
 */
export function Highlight({ children, dark, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <span className={cn("mx-1 inline-block rounded-lg px-2 font-serif font-semibold italic", dark ? "text-lime" : "text-forest", className)}>
      {children}
    </span>
  );
}
