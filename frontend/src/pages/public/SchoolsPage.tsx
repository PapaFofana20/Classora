import { PageHero } from "@/components/layout/PageHero";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { pageHeroes } from "@/data/pageHeroes";
import { aboutStats, schoolPartners } from "@/data/landing";
import { CtaSection } from "@/features/landing/CtaSection";
import { TestimonialsSection } from "@/features/landing/TestimonialsSection";
import { initials } from "@/utils/format";

export default function SchoolsPage() {
  return (
    <>
      <PageHero {...pageHeroes.ecoles} />
      <section className="mx-auto max-w-[1280px] px-5 pb-10 sm:px-8" aria-label="Liste des écoles partenaires">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schoolPartners.map((s, i) => (
            <Reveal key={s.id} delay={i * 60}>
              <article className="h-full rounded-3xl bg-mist p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-lime-soft">
                <div className="flex items-center gap-4">
                  <span className="grid size-14 place-items-center rounded-2xl bg-forest text-lg font-extrabold text-lime">{initials(s.name.split(" ")[0], s.name.split(" ").slice(-1)[0])}</span>
                  <div>
                    <h2 className="font-bold leading-snug">{s.name}</h2>
                    <p className="flex items-center gap-1 text-sm text-neutral-600">
                      <Icon name="location_on" className="text-[16px]" />
                      {s.city}
                    </p>
                  </div>
                </div>
                <p className="mt-5 text-sm font-semibold text-forest">{s.cycles.join(" · ")}</p>
                <p className="mt-4 text-sm text-neutral-600">
                  <strong className="text-forest">{s.students}</strong> élèves suivis
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="px-3 sm:px-5" aria-label="Chiffres clés">
        <div className="mx-auto grid max-w-[1280px] gap-4 rounded-3xl bg-forest p-8 text-center text-white sm:grid-cols-3 sm:p-12">
          {aboutStats.map((s) => (
            <div key={s.label}>
              <p className="text-5xl font-extrabold tracking-tight text-lime">{s.value}</p>
              <p className="mt-1 text-sm text-white/80">{s.label}</p>
            </div>
          ))}
        </div>
      </section>
      <TestimonialsSection />
      <CtaSection />
    </>
  );
}
