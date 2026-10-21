import { ArrowButton } from "@/components/ui/ArrowButton";
import { cn } from "@/utils/cn";

export interface PageHeroProps {
  /** Titre ; un mot encadré par des astérisques est rendu en Playfair italique lime. */
  title: string;
  description: string;
  primaryCta?: { label: string; to: string };
  secondaryCta?: { label: string; to: string };
  image: { src: string; alt: string; objectPosition?: string; width?: number; height?: number };
}

/** Découpe le titre : `*mot*` → Playfair Display italique lime, sans cadre ni poignée. */
function renderTitle(title: string) {
  return title.split("*").map((part, i) =>
    i % 2 === 1 ? (
      <em key={i} className="font-serif font-semibold italic text-lime">
        {part}
      </em>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/**
 * Hero des pages publiques secondaires (Fonctionnalités, Tarifs, Écoles, À propos, Contact).
 *
 * Bloc arrondi DANS le Container, à `var(--hero-top-gap)` du haut de page : aucune
 * place n'est réservée pour la navbar, qui est fixe et le chevauche visuellement.
 * Le contenu du hero commence à `var(--nav-clearance)` pour ne jamais passer dessous.
 */
export function PageHero({ title, description, primaryCta, secondaryCta, image }: PageHeroProps) {
  const height = "min-h-[720px] sm:min-h-[640px] lg:min-h-[540px]";

  return (
    <section className="mt-hero-top mb-hero-bottom px-gutter">
      <div className={cn("relative overflow-hidden rounded-3xl bg-forest", height)}>
        <img
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition: image.objectPosition ?? "50% 50%" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest via-forest/70 to-forest/30" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-forest/80 via-transparent to-transparent" aria-hidden="true" />
        {/* Tiers supérieur densifié (0 → 100 % de la hauteur de la navbar) : la barre
            reste lisible sur toutes les photos. */}
        <div className="absolute inset-x-0 top-0 h-nav-clearance bg-gradient-to-b from-forest/85 via-forest/55 to-transparent" aria-hidden="true" />

        <div className={cn("animate-hero-fade relative z-10 flex flex-col justify-end px-6 pb-6 pt-nav-clearance md:px-10 md:pb-10", height)}>
          <div className="max-w-2xl">
            <h1 className="text-balance text-[clamp(2rem,_1.3rem+2.6vw,_3.25rem)] font-bold leading-[1.1] text-white">{renderTitle(title)}</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">{description}</p>
            {(primaryCta || secondaryCta) && (
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                {primaryCta && (
                  <ArrowButton to={primaryCta.to} className="w-full justify-between sm:w-auto">
                    {primaryCta.label}
                  </ArrowButton>
                )}
                {secondaryCta && (
                  <ArrowButton to={secondaryCta.to} tone="white" className="w-full justify-between sm:w-auto">
                    {secondaryCta.label}
                  </ArrowButton>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}