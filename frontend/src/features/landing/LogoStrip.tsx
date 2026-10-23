import { Container } from "@/components/layout/Container";
import { Icon } from "@/components/ui/Icon";
import { logoStrip } from "@/data/landing";

export function LogoStrip() {
  return (
    <section className="py-12" aria-label="Moyens de paiement et écoles partenaires">
      <Container>
        <p className="mb-8 text-center text-sm font-semibold text-neutral-600">Paiements pris en charge et écoles qui nous font confiance</p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {logoStrip.map((name, i) => (
            <span key={name} className="flex items-center gap-2 whitespace-nowrap text-lg font-bold text-neutral-400 grayscale transition-opacity duration-300 hover:opacity-100">
              <Icon name={i % 7 < 3 ? "contactless" : "school"} fill className="text-[26px]" />
              {name}
            </span>
          ))}
        </div>
      </Container>
    </section>
  );
}