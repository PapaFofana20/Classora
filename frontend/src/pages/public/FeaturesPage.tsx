import { PageHero } from "@/components/layout/PageHero";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { pageHeroes } from "@/data/pageHeroes";
import { roleFeatures } from "@/data/pages";
import { CtaSection } from "@/features/landing/CtaSection";
import { StepsBento } from "@/features/landing/StepsBento";
import { usePageMeta } from "@/hooks/usePageMeta";
import { cn } from "@/utils/cn";

export default function FeaturesPage() {
  usePageMeta({
    title: "Fonctionnalités de Classora",
    description:
      "Inscriptions en ligne, bulletins automatiques, suivi des paiements et messagerie : tout ce que Classora apporte à la direction, aux enseignants et aux parents.",
    path: "/fonctionnalites",
  });
  return (
    <>
      <PageHero {...pageHeroes.fonctionnalites} />

      <section className="mx-auto w-full max-w-[1280px] px-gutter py-16" aria-labelledby="roles-title">
        <Reveal>
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-forest-500">Par rôle</p>
            <h2 id="roles-title" className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              Un espace <span className="font-serif font-semibold italic text-forest-500">adapté</span> à chacun
            </h2>
            <p className="mt-4 text-neutral-600">
              La direction, les enseignants, les élèves et les parents disposent chacun de leur propre espace, avec les outils et les
              informations qui les concernent.
            </p>
          </div>
        </Reveal>
        <div className="space-y-16 lg:space-y-20">
          {roleFeatures.map((r, i) => (
            <Reveal key={r.id}>
              <article className={cn("grid items-center gap-8 lg:grid-cols-2 lg:gap-16", i % 2 === 1 && "lg:[&>div:first-child]:order-2")}>
                <div className="rounded-3xl bg-lime p-2 shadow-pop">
                  <img
                    src={r.image}
                    alt={r.imageAlt}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[4/3] w-full rounded-[1.25rem] object-cover"
                  />
                </div>
                <div>
                  <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-lime-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-forest">
                    <Icon name={r.icon} className="text-[18px] shrink-0 overflow-visible" />
                    {r.role}
                  </p>
                  <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{r.title}</h3>
                  <p className="mt-3 text-neutral-600">{r.description}</p>
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                    {r.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm font-medium">
                        <Icon name="check_circle" fill className="mt-0.5 text-[20px] text-leaf shrink-0 overflow-visible" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <StepsBento />
      <CtaSection />
    </>
  );
}
