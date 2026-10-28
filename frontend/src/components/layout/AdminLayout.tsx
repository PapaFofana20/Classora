import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/context/SidebarContext";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import { MaintenanceBanner } from "./MaintenanceBanner";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePlatformStatus } from "@/context/PlatformContext";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { usePageMeta } from "@/hooks/usePageMeta";

function Shell() {
  const { agent, logout } = useAdminAuth();
  const { status } = usePlatformStatus();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);

  useIdleLogout(status.sessionTimeoutMinutes, () => {
    void logout();
    navigate("/admin/connexion", { replace: true });
  });

  if (!agent) return null; // géré par AdminAuthWrapper / redirection
  return (
    <div className="min-h-screen bg-mist">
      <button type="button" onClick={() => document.getElementById("contenu-admin")?.focus()} className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-lime focus:px-4 focus:py-2">
        Aller au contenu
      </button>
      <div className="mx-auto flex w-full max-w-[1920px] items-start">
        <AdminSidebar agent={agent} drawerOpen={drawer} onClose={() => setDrawer(false)} />
        <div className="min-w-0 flex-1 overflow-x-clip px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pb-10">
          <AdminTopbar agent={agent} onMenu={() => setDrawer(true)} onLogout={logout} />
          <MaintenanceBanner />
          <main id="contenu-admin" tabIndex={-1} key={pathname} className="min-w-0 focus:outline-none">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout() {
  // Console d'administration : jamais proposée aux moteurs de recherche.
  usePageMeta({ noindex: true });
  return (
    <SidebarProvider>
      <Shell />
    </SidebarProvider>
  );
}