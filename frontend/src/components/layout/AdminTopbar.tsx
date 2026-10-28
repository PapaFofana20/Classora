import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AdminAgent } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/Modal";
import { usePlatformStatus } from "@/context/PlatformContext";

export function AdminTopbar({ agent, onMenu, onLogout }: { agent: AdminAgent; onMenu: () => void; onLogout: () => void }) {
  const navigate = useNavigate();
  const { status } = usePlatformStatus();
  const [menu, setMenu] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fullName = `${agent.firstName} ${agent.lastName}`;

  return (
    <>
    <header className="no-print sticky top-0 z-30 -mx-4 mb-4 border-b border-neutral-200/60 bg-mist/90 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur md:-mx-8 md:mb-6 md:px-8 md:pb-3 md:pt-[calc(0.75rem+env(safe-area-inset-top))] lg:py-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <button type="button" onClick={onMenu} aria-label="Ouvrir le menu" className="grid size-11 shrink-0 place-items-center rounded-full bg-white shadow-card lg:hidden">
          <Icon name="menu" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-forest text-xs font-bold text-white">
              {agent.matricule.slice(-2)}
            </span>
            <div>
              <p className="text-sm font-bold text-ink">{status.platformName} Admin</p>
              <p className="text-xs text-neutral-500">{formatDate(new Date().toISOString())}</p>
            </div>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="relative" ref={ref}>
            <button type="button" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} className="flex min-h-11 items-center gap-3 rounded-full bg-white py-1 pl-1 pr-1 shadow-card sm:pr-4">
              <span className="grid size-8 place-items-center rounded-full bg-lime text-xs font-bold text-forest">
                {agent.matricule.slice(-2)}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-bold leading-tight text-ink">{fullName}</span>
                <span className="block text-xs text-neutral-500">{agent.role} · {agent.matricule}</span>
              </span>
              <Icon name="expand_more" className="hidden text-[20px] sm:block" />
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 mt-2 w-56 dropdown-enter rounded-2xl bg-white p-2 shadow-soft ring-1 ring-black/5">
                {status.supportEmail && (
                  <a
                    role="menuitem"
                    href={`mailto:${status.supportEmail}`}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-forest hover:bg-lime-soft"
                  >
                    <Icon name="support_agent" className="text-[20px]" />
                    Contacter le support
                  </a>
                )}
                <button role="menuitem" type="button" onClick={handleLogoutMenu} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-red-50">
                  <Icon name="logout" className="text-[20px]" />
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
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
        onLogout();
      }}
    />
    </>
  );

  function handleLogoutMenu() {
    setMenu(false);
    setConfirmLogout(true);
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}