// Fusionne les classes CSS : clsx pour les conditionnelles, twMerge pour éviter les conflits Tailwind.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Combine plusieurs classes en une seule chaîne propre.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
