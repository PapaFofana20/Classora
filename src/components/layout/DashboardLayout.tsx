import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ChildProvider } from "@/context/ChildContext";
import { useCurrentUser } from "@/context/AuthContext";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { TeachingProvider } from "@/context/TeachingContext";
import { SubscriptionBanner } from "@/features/subscription/SubscriptionBanner";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

function Shell() {
  const user = useCurrentUser();
  const { registerContent } = useSidebar();
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-mist">
      <button type="button" onClick={() => document.getElementById("contenu")?.focus()} className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-lime focus:px-4 focus:py-2">
        Aller au contenu
      </button>
      {/* Deux colonnes dans le flux : la sidebar pousse le contenu, elle ne le recouvre jamais. */}
      <div className="mx-auto flex w-full max-w-[1920px] items-start">
        <Sidebar user={user} drawerOpen={drawer} onClose={() => setDrawer(false)} />
        <div ref={registerContent} className="@container min-w-0 flex-1 overflow-x-clip px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pb-10">
          <Topbar user={user} onMenu={() => setDrawer(true)} />
          <main id="contenu" tabIndex={-1} key={pathname} className="min-w-0 animate-page focus:outline-none">
            <SubscriptionBanner />
            <Outlet />
          </main>
        </div>
      </div>
      <BottomNav user={user} />
    </div>
  );
}

export function DashboardLayout() {
  return (
    <SidebarProvider>
      <TeachingProvider>
        <ChildProvider>
          <Shell />
        </ChildProvider>
      </TeachingProvider>
    </SidebarProvider>
  );
}