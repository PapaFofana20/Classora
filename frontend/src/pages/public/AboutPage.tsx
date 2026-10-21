import { PageHero } from "@/components/layout/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { pageHeroes } from "@/data/pageHeroes";
import { aboutStats, aboutValues } from "@/data/landing";
import aboutTeamImg from "@/assets/images/about-team.jpg";
import { timeline } from "@/data/pages";
import { CtaSection } from "@/features/landing/CtaSection";

export default function AboutPage() {
  return (
    <>
      <PageHero {...pageHeroes.apropos} />
      <section className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-lime p-2 shadow-pop">
            <img src={aboutTeamImg} alt="L'équipe pédagogique d'une école partenaire" className="aspect-[16/8] w-full rounded-[1.25rem] object-cover" loading="lazy" />
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8" aria-labelledby="values-title">
        <Reveal>
          <h2 id="values-title" className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">
            Ce qui nous <span className="font-serif font-semibold italic text-forest-500">guide</span>
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {aboutValues.map((v, i) => (
            <Reveal key={v.title} delay={i * 80}>
              <div className="h-full rounded-3xl bg-mist p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-lime-soft">
                <h3 className="text-lg font-bold">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{v.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-3 sm:px-5" aria-labelledby="timeline-title">
        <div className="mx-auto max-w-[1280px] rounded-3xl bg-forest p-8 text-white sm:p-14">
          <h2 id="timeline-title" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            De l'idée à <span className="font-serif font-semibold italic text-lime">18 écoles</span>
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-4">
            {timeline.map((t) => (
              <li key={t.year} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <p className="text-3xl font-extrabold text-lime">{t.year}</p>
                <h3 className="mt-3 font-bold">{t.title}</h3>
                <p className="mt-2 text-sm text-white/75">{t.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 grid grid-cols-3 gap-3 text-center">
            {aboutStats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-lime p-4 text-forest">
                <p className="text-2xl font-extrabold sm:text-4xl">{s.value}</p>
                <p className="text-xs sm:text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CtaSection />
    </>
  );
}
