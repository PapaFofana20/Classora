// Écrans de chargement locaux entre deux pages, sans tout faire clignoter.
import { Suspense, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { Skeleton } from "./Skeleton";

/**
 * Fallback local à la zone de contenu : pendant le chargement du chunk
 * d'une page, le layout (navbar / sidebar / topbar) reste monté et
 * l'élément cliqué peut déjà afficher son état actif. L'utilisateur
 * voit donc un feedback immédiat au lieu d'un écran entier remplacé
 * par des skeletons (ancien Suspense global dans App.tsx).
 */
export function PageFallback() {
  return (
    <div className="p-1" role="status" aria-label="Chargement de la page">
      <Skeleton className="mb-4 h-10 w-64" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

/** Même chose pour les routes sans layout (auth, mot de passe…). */
export function PageSuspense({ children }: { children?: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children ?? <Outlet />}</Suspense>;
}

/** Wrapper <Route element> : Suspense autour de l'<Outlet /> enfant. */
export function SuspenseOutlet() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Outlet />
    </Suspense>
  );
}
