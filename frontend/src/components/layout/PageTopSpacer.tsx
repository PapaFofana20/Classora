/**
 * Espace réservé sous la navbar fixe pour les pages publiques SANS hero
 * (pages légales, 404… rendues dans PublicLayout).
 *
 * Hauteur = `var(--nav-clearance)` : le contenu ne peut jamais passer sous
 * la barre, et rien n'est rendu visuellement.
 */
export function PageTopSpacer() {
  return <div aria-hidden="true" className="h-nav-clearance" />;
}
