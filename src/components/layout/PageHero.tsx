import { ArrowButton } from "@/components/ui/ArrowButton";
import { cn } from "@/utils/cn";

export interface PageHeroProps {
  /** Titre ; un mot encadré par des astérisques est rendu en Playfair italique lime. */
  title: string;
  description: string;
  primaryCta?: { label: string; to: string };
  secondaryCta?: { label: string; to: string };
  image: { src: string; alt: string; objectPosition?: string; width?: number; height?: number };
  size?: "md" | "lg";
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
 * Reprend exactement la matière du hero de l'accueil : bloc rounded-3xl vert forêt,
 * photo en object-cover, mêmes deux dégradés d'overlay, boutons ArrowButton existants.
 * Aucune pastille, aucun badge, aucune étiquette de section.
 *
 * La navbar est rendue par PublicLayout juste au-dessus : la marge négative
 * (`-mt-*` / `pt-*` compensées) fait remonter le bloc derrière elle, qui reste
 * `sticky` et flottante au défilement avec les mêmes marges — sans dupliquer
 * ni modifier le composant Navbar.
 */
export function PageHero({ title, description, primaryCta, secondaryCta, image, size = "md" }: PageHeroProps) {
  const height = size === "lg" ? "min-h-[400px] md:min-h-[460px] max-h-[480px]" : "min-h-[400px] md:min-h-[420px] max-h-[480px]";

  return (
    <section className="-mt-[76px] px-3 pt-[76px] sm:-mt-[84px] sm:px-5 sm:pt-[84px]">
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

        <div className={cn("animate-hero-fade relative z-10 flex flex-col justify-end p-6 pt-32 md:p-10 md:pt-40", height)}>
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