import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSchool } from "@/context/SchoolContext";
import { useTeaching } from "@/context/TeachingContext";
import { TODAY_ISO } from "@/data/school";
import { useAsync } from "@/hooks/useAsync";
import { countUnread } from "@/services/messageService";
import type { SessionUser } from "@/types";
import { formatLongDate } from "@/utils/format";
import { ROLE_LABELS } from "@/utils/permissions";
import { Avatar, SchoolMark } from "@/components/ui/Brand";
import { ContextSwitcher } from "@/components/ui/ContextSwitcher";
import { Icon } from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/Modal";
import { ChildSwitcher } from "./ChildSwitcher";

export function Topbar({ user, onMenu }: { user: SessionUser; onMenu: () => void }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { contexts, active, setActiveKey } = useTeaching();
  const school = useSchool();
  const unread = useAsync(() => countUnread(user), [user.id, pathname]);
  const [menu, setMenu] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = unread.data ?? 0;

  useEffect(() => {
    const refresh = () => unread.reload();
    window.addEventListener("ec:messages", refresh);
    return () => window.removeEventListener("ec:messages", refresh);
  }, [unread.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handleLogout = () => {
    setConfirmLogout(true);
  };
  const fullName = `${user.firstName} ${user.lastName}`;

  return (
    <>
    <header className="no-print sticky top-0 z-30 -mx-4 mb-4 border-b border-neutral-200/60 bg-mist/90 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur md:-mx-8 md:mb-6 md:px-8 md:pb-3 md:pt-[calc(0.75rem+env(safe-area-inset-top))] lg:py-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <button type="button" onClick={onMenu} aria-label="Ouvrir le menu" className="grid size-11 shrink-0 place-items-center rounded-full bg-white shadow-card lg:hidden">
          <Icon name="menu" />
        </button>
        <div className="min-w-0">
          <SchoolMark name={school.schoolName || "Mon école"} matricule={school.school?.matricule || undefined} size={40} />
          <p className="mt-1 hidden text-xs text-neutral-500 sm:block">{formatLongDate(TODAY_ISO)}</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {user.role === "professeur" && <ContextSwitcher id="ctx-desktop" contexts={contexts} value={active?.key} onChange={setActiveKey} className="hidden w-60 md:block" />}
          {user.role === "parent" && <ChildSwitcher id="child-desktop" className="hidden w-52 md:block" />}
          <Link to="/app/messages" aria-label={count ? `Messages, ${count} non lu${count > 1 ? "s" : ""}` : "Messages"} className="relative grid size-11 place-items-center rounded-full bg-white shadow-card transition hover:bg-lime-soft">
            <Icon name="mail" />
            {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold leading-5 text-white">{count}</span>}
          </Link>
          <div className="relative" ref={ref}>
            <button type="button" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} className="flex min-h-11 items-center gap-3 rounded-full bg-white py-1 pl-1 pr-1 shadow-card sm:pr-4">
              <Avatar name={fullName} size={36} />
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-bold leading-tight text-ink">{fullName}</span>
                <span className="block text-xs text-neutral-500">{ROLE_LABELS[user.role]}</span>
              </span>
              <Icon name="expand_more" className="hidden text-[20px] sm:block" />
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 mt-2 w-56 animate-page rounded-2xl bg-white p-2 shadow-soft ring-1 ring-black/5">
                <Link role="menuitem" to="/app/parametres" onClick={() => setMenu(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-lime-soft">
                  <Icon name="settings" className="text-[20px]" />
                  {user.role === "directeur" ? "Paramètres" : "Mon profil"}
                </Link>
                <button role="menuitem" type="button" onClick={handleLogout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-red-50">
                  <Icon name="logout" className="text-[20px]" />
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {(user.role === "professeur" || user.role === "parent") && (
        <div className="mt-2 md:hidden">
          {user.role === "professeur" ? <ContextSwitcher id="ctx-mobile" contexts={contexts} value={active?.key} onChange={setActiveKey} /> : <ChildSwitcher id="child-mobile" />}
        </div>
      )}
    </header>
    <ConfirmDialog
      open={confirmLogout}
      onCancel={() => setConfirmLogout(false)}
      title="Se déconnecter"
      message="Voulez-vous vraiment vous déconnecter ?"
      confirmLabel="Oui"
      onConfirm={() => {
        setConfirmLogout(false);
        navigate("/", { replace: true });
        logout();
      }}
    />
    </>
  );
}