import { ArrowButton } from "@/components/ui/ArrowButton";
import { Reveal } from "@/components/ui/Reveal";
import { aboutStats, images } from "@/data/landing";

/** Section sombre « À propos » (image arrondie + statistiques encadrées). */
export function AboutSection() {
  return (
    <section className="px-3 sm:px-5" aria-labelledby="about-title">
      <div className="mx-auto max-w-[1280px] rounded-3xl bg-forest p-6 text-white sm:p-10 lg:p-14">
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 id="about-title" className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                Né dans une école, pensé pour <span className="font-serif font-semibold italic text-lime">toutes</span> les écoles.
              </h2>
            </div>
            <div>
              <p className="text-base leading-relaxed text-white/85 sm:text-lg">
                Classora est né du constat de directeurs d'écoles privées sénégalaises : trop de cahiers, de reçus papier et de bulletins refaits à la main. Nous avons construit un outil qui respecte vos réalités : un instituteur titulaire à l'élémentaire, plusieurs professeurs au moyen et secondaire, des coefficients par série et des échéances de scolarité suivies en temps réel.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ArrowButton to="/a-propos">Lire notre histoire</ArrowButton>
                <ArrowButton to="/ecoles" tone="white">
                  Nos écoles partenaires
                </ArrowButton>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_260px]">
            <div className="relative rounded-3xl bg-lime p-2 shadow-pop">
              <img src={images.about} alt="Équipe pédagogique d'une école partenaire" className="aspect-[16/10] w-full rounded-[1.25rem] object-cover" loading="lazy" />
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-3xl bg-lime p-2 lg:grid-cols-1">
              {aboutStats.map((s) => (
                <div key={s.label} className="grid place-items-center rounded-2xl bg-white px-2 py-6 text-center text-forest">
                  <p className="text-3xl font-extrabold tracking-tight sm:text-4xl">{s.value}</p>
                  <p className="mt-1 text-xs font-medium text-neutral-600 sm:text-sm">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
