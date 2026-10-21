import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useSchool } from "@/context/SchoolContext";
import { useTeaching } from "@/context/TeachingContext";
import { navFor, type NavItem } from "@/routes/navigation";
import type { Role, SessionUser } from "@/types";
import { cn } from "@/utils/cn";
import { Icon } from "@/components/ui/Icon";
import { MoreSheet } from "./MoreSheet";

const PRIMARY_PATHS: Record<Role, string[]> = {
  directeur: ["/app", "/app/eleves", "/app/paiements"],
  econome: ["/app", "/app/eleves", "/app/paiements"],
  surveillant: ["/app", "/app/eleves", "/app/messages"],
  instituteur: ["/app", "/app/eleves", "/app/notes"],
  professeur: ["/app", "/app/eleves", "/app/notes"],
  eleve: ["/app", "/app/notes", "/app/bulletins"],
  parent: ["/app", "/app/notes", "/app/paiements"],
};

const SHORT_LABELS: Record<string, string> = {
  "/app": "Accueil",
  "/app/eleves": "Élèves",
  "/app/eleves/demandes": "Demandes",
  "/app/inscription-eleve": "Inscrire",
  "/app/notes": "Notes",
  "/app/bulletins": "Bulletins",
  "/app/paiements": "Paiements",
  "/app/messages": "Messages",
  "/app/parametres": "Profil",
  "/app/abonnement": "Abo",
};

function shortLabel(item: NavItem): string {
  if (SHORT_LABELS[item.to]) return SHORT_LABELS[item.to];
  return item.label.length > 12 ? item.label.split(" ")[0] : item.label;
}

function primaryItems(items: NavItem[], role: Role): NavItem[] {
  const preferred = PRIMARY_PATHS[role]
    .map((path) => items.find((item) => item.to === path))
    .filter((item): item is NavItem => Boolean(item));
  const rest = items.filter((item) => !preferred.some((selected) => selected.to === item.to));
  return [...preferred, ...rest].slice(0, 3);
}

export function BottomNav({ user }: { user: SessionUser }) {
  const { headClasses } = useTeaching();
  const school = useSchool();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = navFor(user.role, { isHead: headClasses.length > 0, locked: school.missing });
  const primary = primaryItems(items, user.role);

  return (
    <>
      <nav
        aria-label="Navigation mobile"
        className="no-print fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex items-center gap-1 rounded-3xl bg-forest px-1.5 py-1 shadow-soft md:hidden"
      >
        {primary.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/app"}
            aria-label={item.label}
            className={({ isActive }) =>
              cn(
                "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] font-semibold leading-none transition",
                isActive ? "bg-lime text-forest" : "text-white/80",
              )
            }
          >
            <Icon name={item.icon} className="text-[22px]" />
            <span className="w-full truncate text-center">{shortLabel(item)}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="Ouvrir le menu complet"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-controls="more-sheet"
          className={cn(
            "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] font-semibold leading-none transition",
            moreOpen ? "bg-lime text-forest" : "text-white/80",
          )}
        >
          <Icon name="apps" className="text-[22px]" />
          <span className="w-full truncate text-center">Plus</span>
        </button>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} user={user} />
    </>
  );
}
