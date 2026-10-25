import { Container } from "@/components/layout/Container";
import { Icon } from "@/components/ui/Icon";
import { logoStrip } from "@/data/landing";

/**
 * Bandeau défilant sur une seule ligne : la liste figure DEUX FOIS dans le
 * track et l'animation translate de -50 % — la boucle est donc sans à-coup.
 * Les marges latérales de chaque élément (mx-5, et non un gap du track)
 * garantissent que la moitié du track correspond exactement à une copie.
 */
export function LogoStrip() {
  return (
    <section className="py-12" aria-label="Moyens de paiement et écoles partenaires">
      <Container>
        <p className="mb-8 text-center text-sm font-semibold text-neutral-600">Paiements pris en charge et écoles qui nous font confiance</p>
        <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="animate-marquee flex w-max items-center">
            {[...logoStrip, ...logoStrip].map((name, i) => (
              <span
                key={`${name}-${i}`}
                aria-hidden={i >= logoStrip.length}
                className="mx-5 flex items-center gap-2 whitespace-nowrap text-lg font-bold text-neutral-400 grayscale transition-opacity duration-300 hover:opacity-100"
              >
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
