import { ArrowButton } from "@/components/ui/ArrowButton";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/layout/Container";

export function CtaSection() {
  return (
    <section className="pb-6 pt-10" aria-labelledby="cta-title">
      <Reveal>
        <Container>
          <div className="relative overflow-hidden rounded-3xl bg-lime p-8 text-center sm:p-16">
          <div className="absolute -left-10 -top-10 size-48 rounded-full bg-white/30" aria-hidden="true" />
          <div className="absolute -bottom-16 -right-10 size-64 rounded-full bg-forest/10" aria-hidden="true" />
          <h2 id="cta-title" className="relative mx-auto max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-forest sm:text-5xl">
            Prêt à digitaliser votre <span className="font-serif font-semibold italic">école</span> pour 2026-2027 ?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-forest/80">Créez votre compte en 2 minutes ou testez l'application avec un compte démo.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <ArrowButton to="/inscription" tone="forest">
              Créer un compte
            </ArrowButton>
            <ArrowButton to="/connexion" tone="white">
              Essayer un compte démo
            </ArrowButton>
          </div>
          </div>
        </Container>
      </Reveal>
    </section>
  );
}
