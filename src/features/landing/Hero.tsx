import { ArrowButton } from "@/components/ui/ArrowButton";
import { Highlight } from "@/features/landing/Highlight";
import { images } from "@/data/landing";

/**
 * Hero de l'accueil : même contrat que PageHero — bloc arrondi dans le Container,
 * `var(--hero-top-gap)` sous le haut de page, navbar fixe chevauchée (aucune place
 * réservée dans le flux) et contenu repoussé à `var(--nav-clearance)`.
 */
export function Hero() {
  return (
    <section className="mt-hero-top mb-hero-bottom px-gutter">
      <div className="relative flex min-h-[660px] flex-col justify-end overflow-hidden rounded-3xl bg-forest">
        <img src={images.hero} alt="Élèves souriants dans une salle de classe au Sénégal" className="absolute inset-0 size-full object-cover" fetchPriority="high" />
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
      </div>
    </section>
  );
}
