import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { CONTACT, navLinks } from "@/data/landing";
import { cn } from "@/utils/cn";
import { ArrowButton } from "@/components/ui/ArrowButton";
import { Logo } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/Button";

/** Navbar flottante en pilule blanche. */
export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  const link = ({ isActive }: { isActive: boolean }) =>
    cn("rounded-full px-4 py-2.5 text-sm font-semibold transition-colors", isActive ? "bg-lime text-forest" : "text-ink hover:bg-lime-soft");

  return (
    <header className="sticky top-3 z-50 px-3 pt-3 sm:px-5 sm:pt-5">
      <nav aria-label="Navigation principale" className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 rounded-full bg-white/95 py-2 pl-4 pr-2 shadow-soft ring-1 ring-forest/5 backdrop-blur">
        <Logo />
        <div className="hidden items-center gap-1 lg:flex">
          {navLinks.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"} className={link}>
              {l.label}
            </NavLink>
          ))}
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`} className="hidden items-center gap-2 pr-2 text-sm font-semibold text-forest 2xl:flex">
            <Icon name="call" className="text-[20px]" />
            {CONTACT.phone}
          </a>
          {user ? (
            <ArrowButton to="/app" tone="forest">
              Mon espace
            </ArrowButton>
          ) : (
            <>
              <LinkButton to="/connexion" variant="ghost">
                Se connecter
              </LinkButton>
              <ArrowButton to="/inscription" tone="forest">
                Créer un compte
              </ArrowButton>
            </>
          )}
        </div>
        <button type="button" className="grid size-11 place-items-center rounded-full bg-forest text-lime lg:hidden" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? "close" : "menu"} />
        </button>
      </nav>
      {open && (
        <div className="mx-auto mt-2 max-w-[1280px] animate-page rounded-3xl bg-white p-4 shadow-soft ring-1 ring-forest/5 lg:hidden">
          <div className="grid gap-1">
            {navLinks.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === "/"} className={({ isActive }) => cn("flex min-h-12 items-center rounded-2xl px-4 text-sm font-semibold", isActive ? "bg-lime text-forest" : "text-ink hover:bg-lime-soft")}>
                {l.label}
              </NavLink>
            ))}
          </div>
          <div className="mt-3 grid gap-2 border-t border-neutral-100 pt-3 sm:grid-cols-2">
            {user ? (
              <LinkButton to="/app" variant="dark" className="sm:col-span-2">
                Mon espace
              </LinkButton>
            ) : (
              <>
                <LinkButton to="/connexion" variant="outline">
                  Se connecter
                </LinkButton>
                <LinkButton to="/inscription" variant="dark">
                  Créer un compte
                </LinkButton>
              </>
            )}
            <LinkButton to="/contact" variant="primary" icon="arrow_outward" className="sm:col-span-2">
              Demander une démo
            </LinkButton>
          </div>
        </div>
      )}
    </header>
  );
}
