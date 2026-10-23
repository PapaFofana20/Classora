import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

/**
 * Site public : fond blanc, une seule navbar fixe rendue ici, puis le contenu.
 *
 * Le hero démarre tout en haut de page (marge --hero-top-gap) et la navbar fixe
 * le chevauche visuellement : aucun espace n'est réservé pour elle dans le flux,
 * donc aucune bande blanche ni boîte vide au-dessus du hero.
 */
export function PublicLayout() {
  const { pathname } = useLocation();
  return (
    // `relative` : ancre la sentinelle de la navbar sur le haut de page.
    // `flow-root` : la marge du hero ne remonte plus sur <body> (décalage au chargement).
    // `overflow-x-clip` : aucun défilement horizontal, sans conteneur de défilement.
    <div className="page-bg relative min-h-svh flow-root overflow-x-clip bg-white">
      <Navbar />
      <main key={pathname}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
