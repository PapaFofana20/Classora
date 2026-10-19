import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSchool } from "@/context/SchoolContext";
import { SIDEBAR_COLLAPSED, SIDEBAR_EXPANDED, useSidebar } from "@/context/SidebarContext";
import { useTeaching } from "@/context/TeachingContext";
import { SCHOOL_YEAR } from "@/data/school";
import { countPendingFor } from "@/services/registrationService";
import { navFor, type NavItem } from "@/routes/navigation";
import type { SessionUser } from "@/types";
import { cn } from "@/utils/cn";
import { ROLE_LABELS } from "@/utils/permissions";
import { Logo, SchoolMark, schoolInitials } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";
import { useAsync } from "@/hooks/useAsync";
import { useModalBehavior } from "@/hooks/useModalBehavior";

/** Zone de tolérance (px) : le pointeur qui sort à moins de 8 px du bord ne déclenche pas le repli. */
const EDGE_TOLERANCE = 8;

/** Délai avant affichage de l'info-bulle au survol (au focus clavier : immédiate). */
const TOOLTIP_DELAY = 300;

/**
 * Info-bulle affichée à droite de l'icône quand la sidebar est repliée.
 * Portail sur document.body : la colonne est en overflow-hidden (transition de largeur),
 * une info-bulle dans le flux serait donc coupée.
 */
function MenuItem({ item, expanded, onNavigate }: { item: NavItem; expanded: boolean; onNavigate?: () => void }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

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
        end={item.to === "/app"}
        onClick={onNavigate}
        aria-label={expanded ? undefined : item.label}
        onPointerEnter={() => showTip(TOOLTIP_DELAY)}
        onPointerLeave={hideTip}
        onFocus={() => showTip(0)}
        onBlur={hideTip}
        className={({ isActive }) =>
          cn(
            "group relative flex min-h-11 items-center rounded-full transition-colors duration-200",
            expanded ? "gap-3 px-4" : "mx-auto size-11 justify-center",
            isActive ? "bg-lime text-forest shadow-lg shadow-black/20" : "text-white/85 hover:bg-white/10",
          )
        }
      >
        <Icon name={item.icon} className="shrink-0 text-[22px]" />
        {/* Libellé : masqué (largeur nulle) dans le rail, fondu avec 80 ms de retard quand la sidebar s'ouvre. */}
        <span
          aria-hidden={!expanded}
          className={cn("whitespace-nowrap transition-opacity duration-200", expanded ? "opacity-100 delay-[80ms]" : "w-0 overflow-hidden opacity-0")}
        >
          {item.label}
        </span>
        {expanded ? (
          item.badge ? (
            <span className="ml-auto grid min-w-6 place-items-center rounded-full bg-danger px-1.5 text-xs font-bold leading-6 text-white">{item.badge}</span>
          ) : null
        ) : (
          item.badge ? <span className="absolute right-1 top-1 size-2 rounded-full bg-danger" aria-hidden="true" /> : null
        )}
      </NavLink>
      {tip && !expanded && createPortal(
        <span role="tooltip" style={{ left: tip.x, top: tip.y }} className="pointer-events-none fixed z-[80] -translate-y-1/2 whitespace-nowrap rounded-xl bg-forest-600 px-3 py-2 text-xs font-semibold text-white shadow-soft">
          {item.label}
        </span>,
        document.body,
      )}
    </li>
  );
}

function SidebarContent({ user, pending, expanded, onNavigate, onLogoClick }: { user: SessionUser; pending: number; expanded: boolean; onNavigate?: () => void; onLogoClick?: () => void }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { headClasses } = useTeaching();
  const school = useSchool();
  const items = navFor(user.role, { isHead: headClasses.length > 0, locked: school.missing, badges: pending > 0 ? { "/app/eleves/demandes": pending } : {} });
  const sections = Array.from(new Set(items.map((i) => i.section)));

  const handleLogout = () => {
    navigate("/", { replace: true });
    logout();
  };

  return (
    <div className="flex h-full flex-col text-white">
      <div className={cn("flex h-[68px] shrink-0 items-center", expanded ? "px-6" : "justify-center px-4")}>
        {expanded ? (
          <Logo dark to="/" />
        ) : (
          <button type="button" onClick={onLogoClick} aria-label={onLogoClick ? "Déplier le menu" : "EcoleConnect, retour à l'accueil"} className="grid size-10 place-items-center rounded-xl bg-lime text-forest">
            <Icon name="school" fill className="text-[24px]" />
          </button>
        )}
      </div>

      <nav aria-label="Menu du tableau de bord" className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
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
                <MenuItem key={i.to} item={i} expanded={expanded} onNavigate={onNavigate} />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="m-4 shrink-0 rounded-2xl bg-black/25 p-4">
        {expanded ? (
          <>
            <p className="text-xs font-bold uppercase tracking-wider text-lime">Année scolaire</p>
            <p className="mt-1 text-lg font-extrabold">{SCHOOL_YEAR}</p>
            <div className="mt-3 border-t border-white/10 pt-3">
              <SchoolMark name={school.schoolName || "École"} size={32} dark />
            </div>
            <p className="mt-3 text-xs text-white/70">
              {ROLE_LABELS[user.role]} · {user.firstName} {user.lastName}
            </p>
            <button type="button" onClick={handleLogout} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-forest-600 text-sm font-semibold transition hover:bg-forest-500">
              <Icon name="logout" className="text-[20px]" />
              Se déconnecter
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-lime text-sm font-extrabold text-forest" aria-label={school.schoolName}>
              {schoolInitials(school.schoolName || "École")}
            </span>
            <button type="button" onClick={handleLogout} aria-label="Se déconnecter" className="grid size-11 place-items-center rounded-full text-white/85 transition hover:bg-white/10">
              <Icon name="logout" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  user: SessionUser;
  drawerOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ user, drawerOpen, onClose }: Props) {
  const { pathname } = useLocation();
  const { user: current } = useAuth();
  const active = current ?? user;
  const sidebar = useSidebar();
  const pending = useAsync(() => (active.role === "directeur" ? countPendingFor(active.schoolId) : Promise.resolve(0)), [active.id, pathname]);
  const columnRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  // Le tiroir mobile force l'ouverture sans toucher à l'épinglage mémorisé.
  const expanded = sidebar.expanded || drawerOpen;

  useEffect(onClose, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useModalBehavior(drawerOpen, onClose, drawerRef);

  const handlers = sidebar.hoverEnabled ? sidebar.handlers : {};

  /**
   * Tolérance de bord : si le pointeur sort vers la droite à moins de 8 px, on ignore la sortie.
   * Évite le repli accidentel quand le contenu se décale sous le curseur.
   */
  const onPointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    const rect = columnRef.current?.getBoundingClientRect();
    const next = event.relatedTarget as Element | null;
    if (rect && next && typeof next.getBoundingClientRect === "function") {
      const target = next.getBoundingClientRect();
      if (target.left - rect.right <= EDGE_TOLERANCE && target.left >= rect.left) return;
    }
    sidebar.handlers.onPointerLeave();
  };

  return (
    <>
      {/* Colonne 1 du flux : elle pousse le contenu (pas de superposition). */}
      <div
        ref={columnRef}
        {...handlers}
        onPointerLeave={sidebar.hoverEnabled ? onPointerLeave : undefined}
        style={{ width: expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED }}
        className={cn(
          "sidebar-col no-print sticky top-3 hidden h-[calc(100svh-24px)] shrink-0 self-start overflow-hidden rounded-3xl bg-forest shadow-card lg:m-3 lg:block",
          sidebar.animating && "will-change-width",
        )}
      >
        <SidebarContent user={active} pending={pending.data ?? 0} expanded={expanded} onLogoClick={sidebar.togglePinned} />
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
            className="absolute inset-y-0 left-0 w-[19rem] max-w-[88vw] overflow-hidden rounded-r-3xl bg-forest pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-soft focus:outline-none"
          >
            <button type="button" onClick={onClose} aria-label="Fermer le menu" className="absolute right-3 top-[max(1rem,env(safe-area-inset-top))] z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white">
              <Icon name="close" />
            </button>
            <SidebarContent user={active} pending={pending.data ?? 0} expanded onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}