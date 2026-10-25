import { useEffect, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSchool } from "@/context/SchoolContext";
import type { Role } from "@/types";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { isAlwaysAllowed } from "./navigation";
import { ContactSchoolScreen, RenewScreen, SubscriptionRequiredScreen } from "@/features/subscription/SubscriptionScreens";
import { usePageMeta } from "@/hooks/usePageMeta";

/** /app/* : redirige vers /connexion si non connecté. */
export function ProtectedRoute() {
  const { user, justLoggedOut, loadingSession } = useAuth();
  const location = useLocation();
  // Restauration de session en cours : ne PAS rediriger — au rechargement
  // direct d'un lien profond, user est encore null et la redirection vers
  // /connexion détruisait l'URL d'origine.
  if (loadingSession) return <div className="min-h-screen bg-mist" aria-hidden="true" />;
  if (!user) return <Navigate to={justLoggedOut ? "/" : "/connexion"} replace state={{ from: location.pathname }} />;
  if (user.status === "DESACTIVE") {
    // Ceinture et bretelles : currentSession() fermant déjà la session d'un
    // compte désactivé, ce cas ne devrait plus se présenter — on évince
    // néanmoins tout user muet qui resterait en mémoire plutôt que servir
    // l'application à un compte désactivé. (EN_ATTENTE est géré par la
    // demande d'inscription côté écran d'accueil, pas par une redirection.)
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

/** /connexion, /inscription : redirige vers /app si déjà connecté. */
export function PublicOnlyRoute() {
  const { user, loadingSession } = useAuth();
  // Attendre la restauration pour éviter le flash « formulaire de connexion »
  // puis rebond vers /app au rechargement d'une page publique.
  if (loadingSession) return <div className="min-h-screen bg-mist" aria-hidden="true" />;
  usePageMeta({ noindex: true });
  if (user) return <Navigate to="/app" replace />;
  return <Outlet />;
}

/** Restreint une page à certains rôles. */
export function RoleRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <EmptyState
        icon="lock"
        title="Accès non autorisé"
        text="Votre rôle ne permet pas de consulter cette page."
        action={
          <LinkButton to="/app" variant="dark">
            Retour au tableau de bord
          </LinkButton>
        }
      />
    );
  }
  return <>{children}</>;
}

/** Mot de passe temporaire : changement obligatoire avant tout accès à l'application. */
export function MustChangePasswordGuard() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user) return <Navigate to="/connexion" replace />;
  if (user.mustChangePassword && pathname !== "/app/mot-de-passe-temporaire") {
    return <Navigate to="/app/mot-de-passe-temporaire" replace />;
  }
  if (!user.mustChangePassword && pathname === "/app/mot-de-passe-temporaire") return <Navigate to="/app" replace />;
  return <Outlet />;
}

/**
 * Verrouille le tableau de bord selon l'abonnement de l'école :
 * • aucun abonnement (directeur) → abonnement + profil uniquement, aperçu flouté ailleurs ;
 * • échéance proche → bandeau d'alerte, accès conservé ;
 * • expirée depuis moins de 7 jours → lecture seule ;
 * • expirée depuis plus de 7 jours → « Contactez votre école » (directeur : « Renouvelez »).
 */
export function SubscriptionGuard() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const school = useSchool();

  if (isAlwaysAllowed(pathname)) return <Outlet />;
  // Tant que l'abonnement n'est pas chargé, on laisse la page afficher ses skeletons.
  if (school.loading) return <Outlet />;

  if (school.blocked && school.schoolId) {
    return user?.role === "directeur" ? <RenewScreen schoolName={school.schoolName} status={school.status} isDirector /> : <ContactSchoolScreen schoolName={school.schoolName} />;
  }
  if (school.missing && school.schoolId) return <SubscriptionRequiredScreen schoolName={school.schoolName} />;
  return <Outlet />;
}

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}
