import { useRef } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { features } from "@/data/landing";

/** Carrousel horizontal de cartes image. */
export function FeaturesCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * 340, behavior: "smooth" });
  const nav = "grid size-12 place-items-center rounded-full border border-forest/20 bg-white text-forest transition hover:bg-forest hover:text-lime";

  return (
    <section className="py-20" aria-labelledby="features-title">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 id="features-title" className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                Tout ce qu'il faut pour <span className="font-serif font-semibold italic text-forest-500">piloter</span> votre école
              </h2>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => scroll(-1)} className={nav} aria-label="Fonctionnalités précédentes">
                <Icon name="arrow_back" />
              </button>
              <button type="button" onClick={() => scroll(1)} className={nav} aria-label="Fonctionnalités suivantes">
                <Icon name="arrow_forward" />
              </button>
            </div>
          </div>
        </Reveal>
      </div>
      <div ref={track} className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 sm:px-8 lg:px-[max(2rem,calc((100%-1280px)/2+2rem))]" tabIndex={0} aria-label="Liste des fonctionnalités">
        {features.map((f) => (
          <Link key={f.id} to="/fonctionnalites" className="group relative aspect-[3/4] max-w-[280px] shrink-0 snap-start overflow-hidden rounded-3xl bg-forest sm:max-w-[320px]">
            <img src={f.image} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-forest via-forest/50 to-transparent" aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white">
              <h3 className="text-xl font-bold leading-snug">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/80">{f.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
