import { PageHero } from "@/components/layout/PageHero";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { CONTACT } from "@/data/landing";
import { pageHeroes } from "@/data/pageHeroes";
import { ContactForm } from "@/features/landing/ContactForm";

const infos = [
  { label: "Téléphone", value: CONTACT.phone },
  { label: "E-mail", value: CONTACT.email },
  { label: "Adresse", value: CONTACT.address },
  { label: "Horaires", value: CONTACT.hours },
];

export default function ContactPage() {
  return (
    <>
      <PageHero {...pageHeroes.contact} />
      <section className="mx-auto grid w-full max-w-[1280px] gap-8 px-gutter pb-20 lg:grid-cols-[1.4fr_1fr]">
        <Reveal>
          <ContactForm />
        </Reveal>
        <Reveal delay={120}>
          <div className="space-y-4">
            {infos.map((i) => (
              <div key={i.label} className="flex items-center gap-4 rounded-3xl bg-lime-soft p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">{i.label}</p>
                  <p className="font-semibold text-forest">{i.value}</p>
                </div>
              </div>
            ))}
            <div className="relative grid h-48 place-items-center overflow-hidden rounded-3xl bg-forest text-white" role="img" aria-label="Carte de localisation, Dakar">
              <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(#c6f068_1.5px,transparent_1.5px)] [background-size:18px_18px]" />
              <div className="relative text-center">
                <Icon name="location_on" fill className="animate-float text-[44px] text-lime" />
                <p className="font-bold">Dakar, Sénégal</p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
