import { PageHero } from "@/components/layout/PageHero";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { features } from "@/data/landing";
import { pageHeroes } from "@/data/pageHeroes";
import { roleHighlights } from "@/data/pages";
import { CtaSection } from "@/features/landing/CtaSection";
import { StepsBento } from "@/features/landing/StepsBento";
import { usePageMeta } from "@/hooks/usePageMeta";
import { cn } from "@/utils/cn";

export default function FeaturesPage() {
  usePageMeta({
    title: "Fonctionnalités de gestion scolaire",
    description:
      "Inscriptions en ligne, bulletins automatiques, suivi des paiements et messagerie : tout ce que Classora apporte à la direction, aux enseignants et aux parents.",
    path: "/fonctionnalites",
  });
  return (
    <>
      <PageHero {...pageHeroes.fonctionnalites} />

      <div className="mx-auto w-full max-w-[1280px] space-y-16 px-gutter py-10">
        {features.map((f, i) => (
          <Reveal key={f.id}>
            <article className={cn("grid items-center gap-8 lg:grid-cols-2 lg:gap-16", i % 2 === 1 && "lg:[&>div:first-child]:order-2")}>
              <div className="rounded-3xl bg-lime p-2 shadow-pop">
                <img src={f.image} alt={`Illustration : ${f.title}`} loading="lazy" decoding="async" className="aspect-[4/3] w-full rounded-[1.25rem] object-cover" />
              </div>
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{f.title}</h2>
                <p className="mt-3 text-neutral-600">{f.description}</p>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm font-medium">
                      <Icon name="check_circle" fill className="mt-0.5 text-[20px] text-leaf" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </Reveal>
        ))}
      </div>

      <section className="mx-auto w-full max-w-[1280px] px-gutter py-16" aria-labelledby="roles-title">
        <Reveal>
          <div className="mb-10 text-center">
            <h2 id="roles-title" className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              Un espace <span className="font-serif font-semibold italic text-forest-500">adapté</span> à chacun
            </h2>
          </div>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roleHighlights.map((r, i) => (
            <Reveal key={r.role} delay={i * 60}>
              <div className="h-full rounded-3xl bg-mist p-6 transition-transform duration-300 hover:-translate-y-1 hover:bg-lime-soft">
                <h3 className="text-lg font-bold">{r.role}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{r.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <StepsBento />
      <CtaSection />
    </>
  );
}
