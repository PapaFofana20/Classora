import { useEffect, useState } from "react";
import { ArrowButton } from "@/components/ui/ArrowButton";
import { Highlight } from "@/features/landing/Highlight";
import { heroSlides } from "@/data/landing";

const SLIDE_DURATION = 8000;

/**
 * Hero de l'accueil : carrousel d'images en arrière-plan (fondu enchaîné toutes
 * les 8 s), même contrat que PageHero — bloc arrondi dans le Container,
 * `var(--hero-top-gap)` sous le haut de page, navbar fixe chevauchée (aucune place
 * réservée dans le flux) et contenu repoussé à `var(--nav-clearance)`.
 */
export function Hero() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setActive((current) => (current + 1) % heroSlides.length);
    }, SLIDE_DURATION);
    return () => window.clearTimeout(id);
  }, [active]);

  return (
    <section className="mt-hero-top mb-hero-bottom px-gutter">
      <div className="relative flex min-h-[680px] flex-col justify-end overflow-hidden rounded-3xl bg-forest sm:min-h-[640px] lg:min-h-[540px]">
        {heroSlides.map((slide, index) => (
          <img
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            aria-hidden={index !== active}
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : "low"}
            decoding="async"
            className={`absolute inset-0 size-full object-cover transition-opacity duration-1000 ease-in-out ${
              index === active ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-forest via-forest/70 to-forest/30" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-forest/80 via-transparent to-transparent" aria-hidden="true" />
        {/* Tiers supérieur densifié : lisibilité de la navbar sur toutes les photos. */}
        <div className="absolute inset-x-0 top-0 h-nav-clearance bg-gradient-to-b from-forest/85 via-forest/55 to-transparent" aria-hidden="true" />

        <div className="relative z-10 grid gap-8 px-6 pb-6 pt-nav-clearance sm:px-10 sm:pb-10 lg:px-14 lg:pb-14">
          <div className="max-w-3xl animate-fade-up">
            <h1 id="hero-title" className="text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Gérez votre école avec <Highlight dark>sérénité</Highlight>, du CI à la Terminale
            </h1>
            <div className="mt-8 flex flex-wrap gap-3">
              <ArrowButton to="/contact">Demander une démo</ArrowButton>
              <ArrowButton to="/fonctionnalites" tone="white">
                Voir les fonctionnalités
              </ArrowButton>
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 right-10 z-10 hidden items-center gap-2 sm:flex lg:bottom-14 lg:right-14" role="tablist" aria-label="Images du carrousel">
          {heroSlides.map((slide, index) => (
            <button
              key={slide.src}
              type="button"
              role="tab"
              aria-label={`Image ${index + 1} sur ${heroSlides.length}`}
              aria-selected={index === active}
              onClick={() => setActive(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === active ? "w-8 bg-lime" : "w-3 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
