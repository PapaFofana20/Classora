import type { ElementType, ReactNode } from "react";
import { cn } from "@/utils/cn";

interface ContainerProps {
  /** Balise du conteneur (par défaut `div`). */
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

/**
 * Colonne de contenu du site public : largeur maximale 1280 px et gouttières
 * latérales issues du token `--gutter` (16 / 24 / 40 px).
 *
 * Utilisée par la navbar, les heroes, le bandeau d'appel à l'action et le
 * footer : les marges blanches sont donc identiques sur toutes les surfaces
 * publiques, sans valeur écrite en dur.
 */
export function Container({ as: Tag = "div", className, children }: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full max-w-[1280px] px-gutter", className)}>{children}</Tag>
  );
}
