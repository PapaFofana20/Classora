import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { steps } from "@/data/landing";
import { cn } from "@/utils/cn";

const tones = ["bg-lime-soft text-forest", "bg-mist text-forest", "bg-lime text-forest"];
const methods = ["Wave", "Orange Money", "Free Money"];

/** Grille bento « Comment ça marche » : la dernière carte, large, est en vert foncé. */
export function StepsBento() {
  return (
    <section className="mx-auto max-w-[1280px] px-5 pb-20 sm:px-8" aria-labelledby="steps-title">
      <Reveal>
        <div className="mb-10 text-center">
          <h2 id="steps-title" className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Opérationnel en <span className="font-serif font-semibold italic text-forest-500">4 étapes</span>
          </h2>
        </div>
      </Reveal>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <Reveal key={s.id} delay={i * 90} className={last ? "md:col-span-3" : ""}>
              <article className={cn("group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl p-7 transition-transform duration-300 hover:-translate-y-1", last ? "min-h-[260px] bg-forest text-white md:flex-row md:items-center md:gap-10 md:p-10" : cn("min-h-[300px]", tones[i]))}>
                <div className={last ? "max-w-xl" : ""}>
                  <div className="mb-8 flex items-center justify-between md:mb-6">
                    <span className={cn("grid size-14 place-items-center rounded-full", last ? "bg-lime text-forest" : "bg-forest text-lime")}>
                      <Icon name={s.icon} fill className="text-[28px]" />
                    </span>
                    <span className={cn("text-6xl font-extrabold tracking-tighter opacity-20", last && "md:hidden")}>0{s.id}</span>
                  </div>
                  <h3 className="text-2xl font-bold">{s.title}</h3>
                  <p className={cn("mt-3 text-sm leading-relaxed", last ? "text-white/80" : "text-neutral-700")}>{s.text}</p>
                </div>
                {last && (
                  <div className="mt-8 flex flex-wrap gap-3 md:mt-0 md:flex-col" aria-label="Moyens de paiement">
                    {methods.map((m) => (
                      <span key={m} className="inline-flex items-center gap-2 text-sm font-semibold text-white/85">
                        <Icon name="check_circle" fill className="text-lime" />
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
