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
        <div className="logo-strip-viewport relative overflow-hidden [contain:paint]">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent sm:w-28"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent sm:w-28"
            aria-hidden="true"
          />
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
                  width={logo.width}
                  height={logo.height}
                  loading="eager"
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
