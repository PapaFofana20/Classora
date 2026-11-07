import { Footer } from "./Footer";
import { Navbar } from "./Navbar";
import { SuspenseOutlet } from "@/components/ui/PageSuspense";

/**
 * Site public : fond blanc, une seule navbar fixe rendue ici, puis le contenu.
 *
 * Le hero démarre tout en haut de page (marge --hero-top-gap) et la navbar fixe
 * le chevauche visuellement : aucun espace n'est réservé pour elle dans le flux,
 * donc aucune bande blanche ni boîte vide au-dessus du hero.
 */
export function PublicLayout() {
  return (
    // `relative` : ancre la sentinelle de la navbar sur le haut de page.
    // `flow-root` : la marge du hero ne remonte plus sur <body> (décalage au chargement).
    // `overflow-x-clip` : aucun défilement horizontal, sans conteneur de défilement.
    <div className="page-bg relative min-h-svh flow-root overflow-x-clip bg-white">
      <Navbar />
      {/* Pas de key={pathname} : il remontait toute la page à chaque clic
          (perte d'état, skeletons et refetch systématiques). Le défilement
          en haut de page est déjà géré par ScrollToTop dans App.tsx. */}
      <main>
        <SuspenseOutlet />
      </main>
      <Footer />
    </div>
  );
}
