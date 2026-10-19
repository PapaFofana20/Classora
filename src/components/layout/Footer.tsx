import { Link } from "react-router-dom";
import { CONTACT, footerColumns } from "@/data/landing";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Brand";
import { Container } from "./Container";

export function Footer() {
  return (
    <footer>
      <Container className="pb-footer-bottom">
        <div className="rounded-3xl bg-forest p-8 text-white sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Logo dark />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/75">
              La plateforme de gestion des écoles privées au Sénégal : inscriptions, bulletins automatiques, paiements mobile money et messagerie parents-enseignants.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-white/85">
              <li className="flex items-center gap-3">
                <Icon name="call" className="text-lime" />
                {CONTACT.phone}
              </li>
              <li className="flex items-center gap-3">
                <Icon name="mail" className="text-lime" />
                {CONTACT.email}
              </li>
              <li className="flex items-center gap-3">
                <Icon name="location_on" className="text-lime" />
                {CONTACT.address}
              </li>
            </ul>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {footerColumns.map((col) => (
              <div key={col.title}>
                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-lime">{col.title}</h3>
                <ul className="space-y-1">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link to={l.to} className="inline-flex min-h-11 items-center text-sm text-white/80 transition-colors hover:text-lime">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/15 pt-6 text-xs text-white/60 sm:flex-row sm:items-center">
          <p>© 2026 EcoleConnect — Année scolaire 2026-2027. Tous droits réservés.</p>
          <p className="flex items-center gap-2">
            <Icon name="verified_user" className="text-[18px] text-lime" />
            Données hébergées de manière sécurisée
          </p>
        </div>
        </div>
      </Container>
    </footer>
  );
}
