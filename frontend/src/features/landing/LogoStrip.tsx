import { Container } from "@/components/layout/Container";
import { partnerLogos } from "@/data/landing";

/**
 * Bandeau défilant sur une seule ligne : la liste figure DEUX FOIS dans le
 * track et l'animation translate de -50 % — la boucle est donc sans à-coup.
 * Les marges latérales de chaque élément (mx-*, et non un gap du track)
 * garantissent que la moitié du track correspond exactement à une copie.
 */
export function LogoStrip() {
  return (
    <section className="py-12" aria-label="Nos partenaires : acteurs de notre excellence, à nos côtés pour construire l'avenir">
      <Container>
        <p className="mb-8 text-center text-sm font-bold text-neutral-600">
          Nos partenaires : acteurs de notre excellence
          <span className="mt-1 block">À nos côtés pour construire l'avenir.</span>
        </p>
        <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="animate-marquee flex w-max items-center">
            {[...partnerLogos, ...partnerLogos].map((logo, i) => (
              <span
                key={`${logo.src}-${i}`}
                aria-hidden={i >= partnerLogos.length}
                className="mx-6 flex shrink-0 items-center sm:mx-9"
              >
                <img
                  src={logo.src}
                  alt={logo.alt}
                  loading="lazy"
                  decoding="async"
                  className="h-10 w-auto sm:h-14"
                />
              </span>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
