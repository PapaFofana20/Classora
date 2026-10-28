import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { SIDEBAR_COLLAPSED, SIDEBAR_EXPANDED, useSidebar } from "@/context/SidebarContext";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Brand";
import { cn } from "@/utils/cn";
import type { AdminAgent } from "@/types";
import { adminNavFor } from "@/routes/adminNavigation";
import { ConfirmDialog } from "@/components/ui/Modal";

const TOOLTIP_DELAY = 300;

function MenuItem({ item, expanded, onNavigate }: { item: any; expanded: boolean; onNavigate?: () => void }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const { pathname, search } = useLocation();

  const toUrl = item.to as string;
  const [toPath, toSearch] = toUrl.split("?");
  const items = (item as any).sectionItems || [];
  const hasSpecificFilterMatch = items.some((i: any) => {
    const [p, s] = (i.to as string).split("?");
    return s && pathname === p && search === `?${s}`;
  });
  const isActive = toSearch
    ? pathname === toPath && search === `?${toSearch}`
    : toPath === "/admin"
      ? pathname === "/admin"
      : pathname.startsWith(toPath) && !hasSpecificFilterMatch;

  const showTip = useCallback((delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const rect = linkRef.current?.getBoundingClientRect();
      if (rect) setTip({ x: rect.right + 12, y: rect.top + rect.height / 2 });
    }, delay);
  }, []);
  const hideTip = useCallback(() => {
    window.clearTimeout(timer.current);
    setTip(null);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <li className="relative">
      <NavLink
        ref={linkRef}
        to={item.to}
        end={toPath === "/admin" && !toSearch}
        onClick={onNavigate}
        aria-label={expanded ? undefined : item.label}
        onPointerEnter={() => showTip(TOOLTIP_DELAY)}
        onPointerLeave={hideTip}
        onFocus={() => showTip(0)}
        onBlur={hideTip}
        className={cn(
          "group relative flex min-h-11 items-center rounded-full transition-colors duration-200",
          expanded ? "gap-3 px-4" : "mx-auto size-11 justify-center",
          isActive ? "bg-lime text-forest shadow-lg shadow-black/20" : "text-white/85 hover:bg-white/10",
        )}
      >
        <Icon name={item.icon} className="shrink-0 text-[22px]" />
        <span
          aria-hidden={!expanded}
          className={cn("whitespace-nowrap transition-opacity duration-200", expanded ? "opacity-100 delay-[80ms]" : "w-0 overflow-hidden opacity-0")}
        >
          {item.label}
        </span>
      </NavLink>
      {tip && !expanded && createPortal(
        <span role="tooltip" style={{ left: tip.x, top: tip.y }} className="pointer-events-none fixed z-[80] -translate-y-1/2 whitespace-nowrap max-w-xs truncate rounded-xl bg-forest-600 px-3 py-2 text-xs font-semibold text-white shadow-soft">
          {item.label}
        </span>,
        document.body,
      )}
    </li>
  );
}

function SidebarContent({ agent, expanded, onNavigate, onLogoClick }: { agent: AdminAgent; expanded: boolean; onNavigate?: () => void; onLogoClick?: () => void }) {
  const { logout } = useAdminAuth();
  const navigate = useNavigate();
  const items = adminNavFor(agent.role);
  const sections = Array.from(new Set(items.map((i) => i.section)));
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleLogout = () => {
    setConfirmLogout(true);
  };

  const bottomContent = (
    <div className="m-4 shrink-0 rounded-2xl bg-black/25 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-lime">Agent Classora</p>
      <p className="mt-1 text-lg font-extrabold">{agent.matricule}</p>
      <div className="mt-3 border-t border-white/10 pt-3">
        <p className="text-xs text-white/70">{agent.firstName} {agent.lastName}</p>
        <p className="mt-1 text-xs text-white/50 capitalize">{agent.role}</p>
      </div>
      <button type="button" onClick={handleLogout} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-forest-600 text-sm font-semibold transition hover:bg-forest-500">
        <Icon name="logout" className="text-[20px]" />
        Se déconnecter
      </button>
    </div>
  );

  const collapsedContent = (
    <div className="flex flex-col items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-lime text-sm font-extrabold text-forest" aria-label={agent.matricule}>
        {agent.matricule.slice(-4)}
      </span>
      <button type="button" onClick={handleLogout} aria-label="Se déconnecter" className="grid size-11 place-items-center rounded-full text-white/85 transition hover:bg-white/10">
        <Icon name="logout" />
      </button>
    </div>
  );

  return (
    <div className="flex h-full flex-col text-white">
      <div className={cn("flex h-[68px] shrink-0 items-center gap-2", expanded ? "px-6" : "justify-center px-4")}>
        {expanded ? (
          <>
            <Logo dark to="/admin" className="h-8" />
            <span className="shrink-0 rounded-full bg-lime/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime">
              Admin
            </span>
          </>
        ) : (
          <button type="button" onClick={onLogoClick} aria-label="Déplier le menu" className="grid size-10 place-items-center rounded-xl bg-lime text-forest">
            <Icon name="school" fill className="text-[24px]" />
          </button>
        )}
      </div>

      <nav aria-label="Menu d'administration" className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
        {sections.map((section) => (
          <div key={section} className="mb-3">
            <div className={cn("mb-2 flex items-center", expanded ? "px-3" : "justify-center")}>
              {expanded ? (
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">{section}</span>
              ) : (
                <span aria-hidden="true" className="h-px w-8 bg-white/15" />
              )}
            </div>
            <ul className="space-y-1">
              {items.filter((i) => i.section === section).map((i) => (
                <MenuItem key={i.to} item={{ ...i, sectionItems: items.filter((x) => x.section === section) }} expanded={expanded} onNavigate={onNavigate} />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {expanded ? bottomContent : collapsedContent}

      <ConfirmDialog
        open={confirmLogout}
        onCancel={() => setConfirmLogout(false)}
        title="Se déconnecter"
        message="Voulez-vous vraiment vous déconnecter ?"
        confirmLabel="Oui"
        onConfirm={() => {
          setConfirmLogout(false);
          navigate("/", { replace: true });
          // logout() est asynchrone (signOut Supabase) : sans ce void explicite,
          // un échec silencieux laisserait la session Auth ouverte.
          void logout();
        }}
      />
    </div>
  );
}

interface Props {
  agent: AdminAgent;
  drawerOpen: boolean;
  onClose: () => void;
}

export function AdminSidebar({ agent, drawerOpen, onClose }: Props) {
  const { pathname } = useLocation();
  const sidebar = useSidebar();
  const expanded = sidebar.expanded || drawerOpen;
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(onClose, [pathname]);

  return (
    <>
      <div
        onPointerEnter={sidebar.hoverEnabled ? sidebar.handlers.onPointerEnter : undefined}
        onPointerLeave={sidebar.hoverEnabled ? sidebar.handlers.onPointerLeave : undefined}
        style={{ width: expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED }}
        className="sidebar-col no-print sticky top-3 hidden h-[calc(100svh-24px)] shrink-0 self-start overflow-hidden rounded-3xl bg-forest shadow-card lg:m-3 lg:block"
      >
        <SidebarContent agent={agent} expanded={expanded} onLogoClick={sidebar.togglePinned} />
      </div>
      {drawerOpen && (
        <div className="no-print fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-forest/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-[19rem] max-w-[88vw] overflow-hidden rounded-r-3xl bg-forest pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-soft focus:outline-none drawer-enter"
          >
            <button type="button" onClick={onClose} aria-label="Fermer le menu" className="absolute right-3 top-[max(1rem,env(safe-area-inset-top))] z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white">
              <Icon name="close" />
            </button>
            <SidebarContent agent={agent} expanded onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}