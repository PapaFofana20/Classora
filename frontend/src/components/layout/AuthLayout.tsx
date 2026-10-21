import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { images } from "@/data/landing";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Brand";

interface Props {
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
  visualTitle?: ReactNode;
  visualText?: string;
}

/** Formulaire à gauche, visuel vert foncé à droite. */
export function AuthLayout({ title, subtitle, children, visualTitle, visualText }: Props) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between">
          <Logo />
          <Link to="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest hover:underline">
            <Icon name="arrow_back" className="text-[18px]" />
            Retour au site
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-neutral-600">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <aside className="relative hidden p-4 lg:block" aria-hidden="true">
        <div className="relative h-full overflow-hidden rounded-3xl bg-forest">
          <img src={images.auth} alt="" className="absolute inset-0 size-full object-cover opacity-40 mix-blend-luminosity" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-t from-forest via-forest/70 to-forest/30" />
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-lime/20 blur-2xl" />
          <div className="relative flex h-full flex-col justify-end p-12 text-white">
            <span className="mb-6 grid size-14 place-items-center rounded-2xl bg-lime text-forest">
              <Icon name="school" fill className="text-[30px]" />
            </span>
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
              {visualTitle ?? (
                <>
                  Toute votre école, <span className="font-serif font-semibold italic text-lime">connectée</span>.
                </>
              )}
            </h2>
            <p className="mt-4 max-w-md text-white/80">{visualText ?? "Inscriptions, bulletins, échéanciers de scolarité et messagerie parents-enseignants, dans un seul espace."}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
