import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { CONTACT, navLinks } from "@/data/landing";
import { useScrolled } from "@/hooks/useScrolled";
import { cn } from "@/utils/cn";
import { ArrowButton } from "@/components/ui/ArrowButton";
import { Logo } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/Button";
import { Container } from "./Container";

/**
 * Navbar publique — UN SEUL élément fixe, rendu une seule fois par PublicLayout.
 *
 * Elle est posée dans le flux fixe dès le chargement (`fixed`, jamais `absolute`
 * puis `fixed`) : aucun saut au défilement. Seule son ASPECT change quand le hero
 * sort de l'écran, via `useScrolled` (IntersectionObserver, sans écouteur de scroll).
 *
 * Géométrie (tokens de index.css) :
 *   wrapper  fixed inset-x-0 top-0 → occupe toute la largeur ;
 *   Container→ mêmes marges blanches que le reste du site ;
 *   nav      top: var(--nav-top) + marge intérieure var(--nav-inset)
 *            → la barre est logée à l'intérieur du hero, avec un espace régulier
 *              entre elle et les bords arrondis de l'image, à toutes largeurs.
 */
export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { pathname } = useLocation();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const scrolled = useScrolled(sentinelRef);

  // Fermeture au changement de route.
  useEffect(() => setOpen(false), [pathname]);

  // Menu mobile : défilement bloqué, Échap ferme et rend le focus au bouton.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const link = ({ isActive }: { isActive: boolean }) =>
    cn("rounded-full px-3 py-2.5 text-sm font-semibold transition-colors", isActive ? "bg-lime text-forest" : "text-ink hover:bg-lime-soft");

  const closeMenu = () => setOpen(false);

  return (
    <>
      <header className="print:hidden pointer-events-none fixed inset-x-0 top-0 z-nav">
        {/* Voile derrière le panneau : frère du Container (jamais à l'intérieur),
            sinon sa zone cliquable passerait devant le fond. */}
        {open && <div className="pointer-events-auto fixed inset-0 bg-forest/40 backdrop-blur-[2px] xl:hidden" onClick={closeMenu} aria-hidden="true" />}
        <Container className="pointer-events-auto relative top-nav-top">
          <nav
            aria-label="Navigation principale"
            className={cn(
              "mx-nav-inset flex h-nav items-center justify-between gap-2 rounded-full border pl-3 pr-1.5",
              "transition-[background-color,border-color,box-shadow] duration-200",
              scrolled ? "border-forest/10 bg-white shadow-card" : "border-transparent bg-white/90 shadow-soft backdrop-blur-md",
            )}
          >
            <Logo />
            {/* La ligne complète (logo + 6 liens + téléphone + 2 boutons) ne tient
                qu'à partir de 1280 px : gouttière 40 px + inset 20 px de chaque côté
                du Container de 1280 px max. En dessous, barre compacte + menu. */}
            <div className="hidden items-center gap-1 xl:flex">
              {navLinks.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.to === "/"} className={link}>
                  {l.label}
                </NavLink>
              ))}
            </div>
            <div className="hidden items-center gap-2 xl:flex">
              <a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`} className="hidden items-center gap-2 text-sm font-semibold text-forest 2xl:flex">
                <Icon name="call" className="text-[20px]" />
                {CONTACT.phone}
              </a>
              {user ? (
                <ArrowButton to="/app" tone="forest">
                  Mon espace
                </ArrowButton>
              ) : (
                <>
                  <LinkButton to="/connexion" variant="ghost" className="px-4">
                    Se connecter
                  </LinkButton>
                  <ArrowButton to="/inscription" tone="forest">
                    Créer un compte
                  </ArrowButton>
                </>
              )}
            </div>
            <button
              ref={toggleRef}
              type="button"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-forest text-lime xl:hidden"
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={open}
              aria-controls="menu-mobile"
              onClick={() => setOpen((o) => !o)}
            >
              <Icon name={open ? "close" : "menu"} />
            </button>
          </nav>

          {open && (
            <>
              {/* Le panneau ne contient que des liens : tout clic dedans referme le menu. */}
              <div id="menu-mobile" onClick={closeMenu} className="animate-page mx-nav-inset mt-2 rounded-3xl bg-white p-4 shadow-soft ring-1 ring-forest/5 xl:hidden">
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
            </>
          )}
        </Container>
      </header>

      {/* Sentinelle : absente du flux (absolue), elle ne réserve aucune place.
          Le wrapper parent doit être `relative` pour qu'elle vise le haut de page. */}
      <div ref={sentinelRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-nav-clearance" />
    </>
  );
}
