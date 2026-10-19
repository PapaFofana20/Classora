import { useEffect, useState, type RefObject } from "react";

/**
 * Vrai dès que la sentinelle du haut de page a quitté le viewport
 * (c'est-à-dire quand le hero est sorti de l'écran).
 *
 * IntersectionObserver uniquement : aucun écouteur de `scroll`, aucun
 * recalcul de position, donc aucun saut de mise en page au défilement.
 */
export function useScrolled(sentinel: RefObject<Element | null>): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sentinel]);

  return scrolled;
}
