import { ArrowButton } from "@/components/ui/ArrowButton";
import { Highlight } from "@/features/landing/Highlight";
import { images } from "@/data/landing";

export function Hero() {
  return (
    <section className="mx-auto max-w-[1280px] px-3 pt-3 sm:px-5">
      <div className="relative mx-auto flex min-h-[560px] max-w-[1280px] flex-col justify-end overflow-hidden rounded-3xl bg-forest lg:min-h-[640px]">
        <img src={images.hero} alt="Élèves souriants dans une salle de classe au Sénégal" className="absolute inset-0 size-full object-cover" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest via-forest/70 to-forest/30" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-forest/80 via-transparent to-transparent" aria-hidden="true" />

        <div className="relative z-10 grid gap-8 p-6 sm:p-10 lg:p-14">
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
