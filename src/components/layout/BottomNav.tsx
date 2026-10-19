import { NavLink } from "react-router-dom";
import { useSchool } from "@/context/SchoolContext";
import { useTeaching } from "@/context/TeachingContext";
import { navFor } from "@/routes/navigation";
import type { SessionUser } from "@/types";
import { cn } from "@/utils/cn";
import { Icon } from "@/components/ui/Icon";

/** Barre de navigation basse (mobile). */
export function BottomNav({ user, onMore }: { user: SessionUser; onMore: () => void }) {
  const { headClasses } = useTeaching();
  const school = useSchool();
  const items = navFor(user.role, { isHead: headClasses.length > 0, locked: school.missing }).slice(0, 4);
  const short = (label: string) => label.replace("Suivi de mes enfants", "Suivi").replace("Ma scolarité", "Accueil").replace("Tableau de bord", "Accueil").replace("Inscription élève", "Inscrire").replace("Demandes d'inscription", "Demandes");
  return (
    <nav aria-label="Navigation mobile" className="no-print fixed inset-x-3 bottom-3 z-50 flex items-center justify-between rounded-full bg-forest px-2 py-1.5 shadow-soft md:hidden">
      {items.map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          end={i.to === "/app"}
          aria-label={i.label}
          className={({ isActive }) => cn("flex min-h-12 min-w-14 flex-1 flex-col items-center justify-center rounded-full px-2 text-[10px] font-semibold transition", isActive ? "bg-lime text-forest" : "text-white/80")}
        >
          <Icon name={i.icon} className="text-[22px]" />
          {short(i.label)}
        </NavLink>
      ))}
      <button type="button" onClick={onMore} aria-label="Ouvrir le menu complet" className="flex min-h-12 min-w-14 flex-1 flex-col items-center justify-center rounded-full px-2 text-[10px] font-semibold text-white/80">
        <Icon name="menu" className="text-[22px]" />
        Menu
      </button>
    </nav>
  );
}