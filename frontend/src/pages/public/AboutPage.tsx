import { PageHero } from "@/components/layout/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { pageHeroes } from "@/data/pageHeroes";
import { aboutValues, aboutStats } from "@/data/landing";
import { CtaSection } from "@/features/landing/CtaSection";
import { Counter } from "@/components/ui/Counter";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function AboutPage() {
  usePageMeta({
    title: "À propos",
    description:
      "L'équipe Classora et sa mission : outiller les écoles privées du Sénégal avec des outils simples, adaptés aux réalités locales, du CI à la Terminale.",
    path: "/a-propos",
  });
  return (
    <>
      <PageHero {...pageHeroes.apropos} />
      <section className="mx-auto w-full max-w-[1280px] px-gutter pb-14 md:pb-16" aria-labelledby="mission-title">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-lime-pale px-6 pt-12 text-center sm:pt-14 md:pt-16">
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-50 [background-image:radial-gradient(#c6f068_1.5px,transparent_1.5px)] [background-size:18px_18px]"
            />
            <div
              aria-hidden="true"
              className="absolute bottom-0 left-1/2 size-[420px] -translate-x-1/2 translate-y-1/3 rounded-full bg-lime/40 blur-2xl md:size-[560px]"
            />
            <div className="relative">
              <h2 id="mission-title" className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl max-w-3xl mx-auto text-center">
                <span className="text-lime">Classora</span> : pensé pour <span className="font-serif font-semibold italic text-forest-500">les réalités de nos écoles</span>
              </h2>
              <div className="mt-8 max-w-3xl mx-auto space-y-4 text-lg leading-relaxed text-neutral-700 text-center sm:mt-10 md:mt-12">
                <p>
                  <strong className="text-ink">Tout est parti d'un constat simple :</strong> dans de nombreuses écoles privées sénégalaises, la gestion scolaire repose encore sur des piles de cahiers, des reçus papier et des bulletins laborieusement préparés à la main. Un fonctionnement chronophage qui complique le quotidien des équipes et freine l'efficacité des établissements.
                </p>
                <p>
                  <strong className="text-ink">Nous avons imaginé Classora pour changer cela.</strong> Une solution conçue autour de la réalité de nos écoles : un instituteur titulaire pour une classe à l'élémentaire, plusieurs professeurs au moyen et au secondaire, des coefficients adaptés à chaque série et un suivi des échéances de scolarité en temps réel.
                </p>
                <p>
                  Parce que gérer une école ne devrait pas être une succession de tâches administratives, mais un moyen de mieux accompagner chaque élève et de faire grandir son établissement.
                </p>
              </div>
            </div>
            <img
              src="/images/about-team.png"
              alt="L'équipe Classora : deux collaborateurs en polo vert Classora et un responsable, avec un ordinateur portable et une tablette"
              width={1672}
              height={941}
              decoding="async"
              className="relative -mx-[30%] mt-8 block h-auto w-[160%] max-w-none sm:mx-auto sm:h-72 sm:w-auto md:h-80 lg:h-96"
            />
          </div>
        </Reveal>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-gutter py-20" aria-labelledby="values-title">
        <Reveal>
          <h2 id="values-title" className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">
            Ce qui nous <span className="font-serif font-semibold italic text-forest-500">guide</span>
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {aboutValues.map((v, i) => (
            <Reveal key={v.title} delay={i * 80}>
              <article className="group relative flex h-full min-h-[300px] flex-col justify-between overflow-hidden rounded-3xl border-2 border-forest/10 bg-lime p-7 text-forest shadow-pop transition-transform duration-300 hover:-translate-y-1">
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold">{v.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-700">{v.text}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-gutter" aria-labelledby="vision-title">
        <div className="rounded-3xl bg-forest p-8 text-white sm:p-14 lg:p-16">
          <Reveal>
            <header className="lg:max-w-none">
              <h2 id="vision-title" className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-tight">
                En <span className="text-lime">2030</span>, la gestion scolaire doit être plus simple.
              </h2>
              <div className="mt-8 space-y-6 text-lg leading-relaxed text-white/85">
                <p>
                  Nous imaginons un avenir où les établissements scolaires passent moins de temps à gérer la complexité administrative et disposent de meilleurs outils pour organiser leur quotidien, suivre leurs élèves et coordonner leurs équipes. C'est cette vision qui guide le développement de Classora.
                </p>
                <p>
                  D'ici 2030, Classora ambitionne de devenir le système nerveux des écoles privées sénégalaises : une plateforme qui centralise la vie administrative, pédagogique et financière de l'établissement, tout en s'adaptant aux spécificités de chaque cycle — de l'instituteur titulaire à l'élémentaire aux professeurs spécialisés par matière au secondaire. L'objectif n'est pas de standardiser à outrance, mais d'offrir un socle commun fiable sur lequel chaque école construit sa propre organisation.
                </p>
                <p>
                  Cette vision passe aussi par une relation transformée avec les familles : des paiements mobiles fluides et sécurisés, un accès transparent aux bulletins et aux échéances, une communication directe avec les enseignants. Et par des outils d'aide à la décision pour les directions — tableaux de bord financiers en temps réel, alertes automatiques sur les impayés, projection de trésorerie — pour que la gestion ne soit plus une charge réactive, mais un levier stratégique.
                </p>
              </div>
            </header>
          </Reveal>

          <Reveal delay={200}>
            <blockquote className="mt-16 text-center">
              <p className="text-lg font-semibold text-white/90 italic">
                "<span className="text-lime">2030</span> n'est pas une destination figée. C'est le cap qui guide chaque évolution de Classora."
              </p>
            </blockquote>
          </Reveal>

          <Reveal delay={300}>
            <div className="mt-12 grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {aboutStats.map((stat, i) => (
                <Reveal key={stat.label} delay={i * 100}>
                  <Counter value={stat.value} label={stat.label} delay={i * 200} />
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
      <CtaSection />
    </>
  );
}
