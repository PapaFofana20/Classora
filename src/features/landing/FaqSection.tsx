import { Accordion } from "@/components/ui/Accordion";
import { Reveal } from "@/components/ui/Reveal";
import { faqs } from "@/data/landing";

export function FaqSection() {
  return (
    <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8" aria-labelledby="faq-title">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <Reveal>
          <h2 id="faq-title" className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Vos <span className="font-serif font-semibold italic text-forest-500">questions</span>, nos réponses
          </h2>
          <p className="mt-4 text-neutral-600">Une autre question ? Écrivez-nous, nous répondons sous 24 heures.</p>
        </Reveal>
        <Reveal delay={100}>
          <Accordion items={faqs} />
        </Reveal>
      </div>
    </section>
  );
}
