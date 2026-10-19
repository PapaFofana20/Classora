import { ArrowButton } from "@/components/ui/ArrowButton";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { plans } from "@/data/landing";
import { cn } from "@/utils/cn";

export function PricingSection({ withHeader = true }: { withHeader?: boolean }) {
  return (
    <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8" aria-labelledby="pricing-title">
      {withHeader && (
        <Reveal>
          <div className="mb-12 text-center">
            <h2 id="pricing-title" className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Un prix simple, <span className="font-serif font-semibold italic text-forest-500">par élève</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-neutral-600">Pas de frais d'installation. Vous ne payez que pour les élèves inscrits dans votre école.</p>
          </div>
        </Reveal>
      )}
      <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
        {plans.map((p, i) => (
          <Reveal key={p.id} delay={i * 100}>
            <article className={cn("relative flex h-full flex-col rounded-3xl p-8 transition-transform duration-300 hover:-translate-y-1", p.highlight ? "bg-forest text-white shadow-soft" : "bg-mist")}>
              <h3 className="text-lg font-bold">{p.name}</h3>
              <p className={cn("mt-1 text-sm", p.highlight ? "text-white/70" : "text-neutral-600")}>{p.description}</p>
              <p className="mt-6 text-4xl font-extrabold tracking-tight">{p.price}</p>
              <p className={cn("text-sm", p.highlight ? "text-white/70" : "text-neutral-500")}>{p.unit}</p>
              <ul className="my-7 flex-1 space-y-3 text-sm">
                {p.items.map((it) => (
                  <li key={it} className="flex items-start gap-3">
                    <Icon name="check_circle" fill className={cn("mt-0.5 text-[20px]", p.highlight ? "text-lime" : "text-leaf")} />
                    {it}
                  </li>
                ))}
              </ul>
              <ArrowButton to={p.id === "reseau" ? "/contact" : "/inscription"} tone={p.highlight ? "lime" : "forest"}>
                {p.id === "reseau" ? "Demander un devis" : "Choisir " + p.name}
              </ArrowButton>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
