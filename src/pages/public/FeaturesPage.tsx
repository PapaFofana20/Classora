import { ArrowButton } from "@/components/ui/ArrowButton";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { features } from "@/data/landing";
import { roleHighlights } from "@/data/pages";
import { CtaSection } from "@/features/landing/CtaSection";
import { Highlight } from "@/features/landing/Highlight";
import { PageHero } from "@/features/landing/PageHero";
import { StepsBento } from "@/features/landing/StepsBento";
import { cn } from "@/utils/cn";

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        title={
          <>
            Tout pour gérer votre école, <Highlight>simplement</Highlight>
          </>
        }
        text="Des inscriptions aux bulletins, des paiements mobile money à la messagerie : EcoleConnect couvre le quotidien des écoles privées sénégalaises."
      >
        <ArrowButton to="/inscription">Créer un compte</ArrowButton>
        <ArrowButton to="/connexion" tone="white">
          Essayer la démo
        </ArrowButton>
      </PageHero>

      <div className="mx-auto max-w-[1280px] space-y-16 px-5 py-10 sm:px-8">
        {features.map((f, i) => (
          <Reveal key={f.id}>
            <article className={cn("grid items-center gap-8 lg:grid-cols-2 lg:gap-16", i % 2 === 1 && "lg:[&>div:first-child]:order-2")}>
              <div className="rounded-3xl bg-lime p-2 shadow-pop">
                <img src={f.image} alt={f.title} loading="lazy" className="aspect-[4/3] w-full rounded-[1.25rem] object-cover" />
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

      <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8" aria-labelledby="roles-title">
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
              <div className="h-full rounded-3xl bg-mist p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-lime-soft">
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
