import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import type { AdminAgentRole } from "@/types";
import { ADMIN_ROUTE_ROLES } from "./adminNavigation";

/** /admin/* : redirige vers /admin/connexion si non connecté en tant qu'agent. */
export function AdminProtectedRoute() {
  const { agent, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) return null;

  if (!agent) {
    return <Navigate to="/admin/connexion" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** Restreint une route admin à certains rôles. */
export function AdminRoleRoute({ roles, children }: { roles: AdminAgentRole[]; children: React.ReactNode }) {
  const { agent } = useAdminAuth();
  if (!agent || !roles.includes(agent.role)) {
    return (
      <EmptyState
        icon="lock"
        title="Accès non autorisé"
        text="Votre rôle d'agent ne permet pas de consulter cette page."
        action={
          <LinkButton to="/admin" variant="dark">
            Retour au tableau de bord
          </LinkButton>
        }
      />
    );
  }
  return <>{children}</>;
}

/** Garde de rôle basé sur la route (utilisé dans App.tsx). */
export function adminGuard(routeKey: keyof typeof ADMIN_ROUTE_ROLES, element: React.ReactElement) {
  return <AdminRoleRoute roles={ADMIN_ROUTE_ROLES[routeKey]}>{element}</AdminRoleRoute>;
}