import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { testimonials } from "@/data/landing";
import { cn } from "@/utils/cn";

export function TestimonialsSection() {
  return (
    <section className="mx-auto w-full max-w-[1280px] px-gutter py-16" aria-labelledby="testi-title">
      <Reveal>
        <div className="mb-12 text-center">
          <h2 id="testi-title" className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Ils ont <span className="font-serif font-semibold italic text-forest-500">simplifié</span> leur quotidien
          </h2>
        </div>
      </Reveal>
      <div className="grid gap-5 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <Reveal key={t.id} delay={i * 100}>
            <figure className={cn("group flex h-full flex-col overflow-hidden rounded-3xl transition-transform duration-300 hover:-translate-y-1", i === 1 ? "bg-forest text-white" : "bg-lime-soft")}>
              <div className="aspect-[4/5] w-full overflow-hidden bg-neutral-200">
                <img
                  src={t.photo}
                  alt={t.photoAlt}
                  width={800}
                  height={1000}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex flex-1 flex-col p-7">
                <Icon name="format_quote" fill className={cn("text-[44px]", i === 1 ? "text-lime" : "text-leaf")} />
                <blockquote className="mt-3 flex-1 text-base leading-relaxed">« {t.quote} »</blockquote>
                <figcaption className="mt-6">
                  <p className="text-sm font-bold">{t.name}</p>
                  <p className={cn("text-xs", i === 1 ? "text-white/70" : "text-neutral-600")}>
                    {t.role} · {t.school}
                  </p>
                </figcaption>
              </div>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
