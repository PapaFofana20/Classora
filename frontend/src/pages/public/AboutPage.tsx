import { PageHero } from "@/components/layout/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { pageHeroes } from "@/data/pageHeroes";
import { aboutValues, aboutStats } from "@/data/landing";
const aboutTeamImg = "/images/about-team.jpg";
import { CtaSection } from "@/features/landing/CtaSection";
import { Icon } from "@/components/ui/Icon";
import { Counter } from "@/components/ui/Counter";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function AboutPage() {
  usePageMeta({
    title: "À propos de Classora",
    description:
      "L'équipe Classora et sa mission : outiller les écoles privées du Sénégal avec des outils simples, adaptés aux réalités locales, du CI à la Terminale.",
    path: "/a-propos",
  });
  return (
    <>
      <PageHero {...pageHeroes.apropos} />
      <section className="mx-auto w-full max-w-[1280px] px-gutter py-16" aria-labelledby="mission-title">
        <Reveal>
          <h2 id="mission-title" className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl max-w-3xl mx-auto text-center">
            <span className="text-lime">Classora</span> : pensé pour <span className="font-serif font-semibold italic text-forest-500">les réalités de nos écoles</span>
          </h2>
          <div className="mt-8 max-w-3xl mx-auto space-y-4 text-lg leading-relaxed text-neutral-700 text-center">
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
        </Reveal>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-gutter py-16" aria-hidden="true">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-lime p-2 shadow-pop">
            <img
              src={aboutTeamImg}
              alt="L'équipe pédagogique d'une école partenaire"
              className="aspect-[16/8] w-full rounded-[1.25rem] object-cover"
              loading="lazy"
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
              <div className="h-full rounded-3xl bg-mist p-6 transition-transform duration-300 hover:-translate-y-1 hover:bg-lime-soft">
                <h3 className="text-lg font-bold">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{v.text}</p>
              </div>
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

          <Reveal>
            <div className="mt-12 lg:mt-16 grid gap-6 lg:grid-cols-3">
              {[
                {
                  title: "Simplifier",
                  text: "Moins de tâches répétitives, des informations mieux organisées et des outils conçus pour faciliter le travail quotidien des équipes éducatives.",
                  icon: "auto_fix_high"
                },
                {
                  title: "Connecter",
                  text: "Une meilleure circulation de l'information entre les acteurs de l'école, grâce à des outils adaptés à leurs rôles et à leurs besoins.",
                  icon: "hub"
                },
                {
                  title: "Faire évoluer",
                  text: "Une plateforme qui progresse avec les établissements, en tenant compte de leurs réalités et des besoins qui émergent sur le terrain.",
                  icon: "trending_up"
                }
              ].map((pillar, i) => (
                <Reveal key={pillar.title} delay={i * 80}>
                  <article className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 hover:ring-white/20 transition-transform duration-300 hover:-translate-y-1 hover:bg-white/10">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="grid size-10 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10">
                        <Icon name={pillar.icon} className="text-lime text-[22px]" />
                      </span>
                      <h3 className="font-bold text-lg">{pillar.title}</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-white/85">{pillar.text}</p>
                  </article>
                </Reveal>
              ))}
            </div>
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
