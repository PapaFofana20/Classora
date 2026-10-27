import { useEffect } from "react";

/**
 * Domaine canonique du site (déploiement Render). Toutes les balises
 * canoniques, og:url et le sitemap s'y réfèrent — à mettre à jour si le site
 * passe sur un domaine personnalisé.
 */
export const SITE_URL = "https://classora-gsay.onrender.com";

export interface PageMeta {
  /** Titre de la page ; « | Classora » est ajouté automatiquement. */
  title?: string;
  /** Meta description de la page (≤ 160 caractères recommandés). */
  description?: string;
  /** Chemin canonique de la page (ex. "/tarifs"). */
  path?: string;
  /** true pour les pages privées ou sans intérêt pour les moteurs. */
  noindex?: boolean;
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Pilote le <head> de la page courante : titre, description, canonical,
 * robots et Open Graph. Le rendu reste 100 % client (SPA) : sans ce hook,
 * toutes les pages partagent le titre statique d'index.html.
 */
export function usePageMeta({ title, description, path, noindex }: PageMeta) {
  useEffect(() => {
    const fullTitle = title !== undefined ? (title.toLowerCase().includes("classora") ? title : `${title} | Classora`) : undefined;
    if (fullTitle !== undefined) {
      document.title = fullTitle;
      upsertMeta("property", "og:title", fullTitle);
      upsertMeta("name", "twitter:title", fullTitle);
    }
    if (description !== undefined) {
      upsertMeta("name", "description", description);
      upsertMeta("property", "og:description", description);
      upsertMeta("name", "twitter:description", description);
    }
    upsertMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");

    if (path !== undefined) {
      const url = `${SITE_URL}${path}`;
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", url);
      upsertMeta("property", "og:url", url);
    }
  }, [title, description, path, noindex]);
}
