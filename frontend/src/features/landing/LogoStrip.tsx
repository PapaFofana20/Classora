import { Container } from "@/components/layout/Container";
import { Icon } from "@/components/ui/Icon";
import { logoStrip } from "@/data/landing";

export function LogoStrip() {
  const list = [...logoStrip, ...logoStrip];
  return (
    <section className="py-12" aria-label="Moyens de paiement et écoles partenaires">
      <Container>
        <p className="mb-8 text-center text-sm font-semibold text-neutral-600">Paiements pris en charge et écoles qui nous font confiance</p>
        <div className="relative mx-auto max-w-[1100px] overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
          <div className="flex w-max animate-marquee gap-14 py-2">
            {list.map((name, i) => (
              <span key={`${name}-${i}`} className="flex items-center gap-2 whitespace-nowrap text-lg font-bold text-neutral-400 grayscale">
                <Icon name={i % 7 < 3 ? "contactless" : "school"} fill className="text-[26px]" />
                {name}
              </span>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
