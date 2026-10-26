# Audit SEO Classora — corrections proposées

## Constats majeurs (audit terminé, tout testé sur le site déployé)

1. **CRITIQUE — 12,2 Mo de HTML** (8,4 Mo gzip mesurés en production) : les 8,4 Mo d'images JPG de `src/assets/` sont importées dans le code et donc **inlinées en base64** par `vite-plugin-singlefile`. LCP/TTI catastrophiques sur mobile.
2. **CRITIQUE — méta-données uniques** : `<title>Classora</title>` pour les 8 pages publiques, aucune description par page, aucune balise canonique, aucun Open Graph / Twitter Card.
3. **CRITIQUE — `robots.txt` absent (404)**, **`sitemap.xml` absent** (l'URL renvoie le HTML de la SPA).
4. **Pas de page 404** : les URLs inconnues redirigent vers `/` (soft-404) ; le serveur renvoie 200 pour tout.
5. **Aucune donnée structurée Schema.org.**
6. Détails : `aria-labelledby` cassé (PricingSection), images sans `width/height` (CLS), 5 `alt=""` sur le carrousel d'accueil, H1 dupliqué entre l'accueil et /a-propos, H2 de CTA identique sur 5 pages, ContactPage sans contenu indexable, meta description citant des paiements par opérateurs dont le flux backend a été retiré (migration 00016) — à reformuler sans nom d'opérateur (décision réversible, signalée).

## Corrections (par impact décroissant)

### A. Sortir les images du bundle (~ −11 Mo)
Déplacer `src/assets/images/*` vers `public/images/` et remplacer les imports par des chemins `/images/…` (uniquement dans les fichiers de données). L'architecture singlefile est préservée ; les images deviennent des fichiers séparés, cacheables et chargés à la demande. Vérification : `dist/index.html` attendu à ~1 Mo.

### B. Méta-données par page (SPA)
Hook `usePageMeta({ title, description, noindex? })` appliqué aux 8 pages publiques + `noindex` sur `/connexion`, `/inscription`, pages mot de passe, tout `/app` et `/admin`, et la future 404. `index.html` enrichi : title descriptif, OG/Twitter complet (og:image absolue), canonical par défaut.

### C. robots.txt + sitemap.xml (public/)
`robots.txt` : autorise les pages publiques, interdit `/app`, `/admin`, pages d'auth ; déclare le sitemap. `sitemap.xml` : les 8 URLs publiques avec lastmod. Domaine canonique : `https://classora-gsay.onrender.com` (signalé : un domaine personnalisé serait préférable à terme).

### D. Page 404
Route `*` → page « Introuvable » (au lieu de la redirection), avec liens vers l'accueil / tarifs / fonctionnalités, `noindex`.

### E. Données structurées (factuelles uniquement)
JSON-LD `Organization` + `WebSite` (accueil ; nom, URL, logo, e-mail de contact déjà publics sur le site) et `FAQPage` reprenant **uniquement** les questions/réponses visibles de la FAQ d'accueil. Aucune affirmation créée.

### F. Corrections ciblées contenu/a11y/CLS
- `alt` descriptifs sur le carrousel d'accueil (cohérents avec la page Fonctionnalités) ; `width/height` sur les images listées par l'audit.
- Correction du `aria-labelledby` cassé de PricingSection.
- H1 d'/a-propos conservé, **H2 de l'accueil reformulé** (suppression du doublon) ; titre CTA déclassé en `<p>` (mêmes classes, rendu identique).
- ContactPage : ajout de H2 de structure et de liens internes contextuels (vers tarifs / fonctionnalités), sans inventer de contenu.

## Vérifications prévues
`tsc --noEmit`, `npm run build` (taille du bundle avant/après), `vite preview` + curl (robots.txt, sitemap.xml, page 404, titres), script d'audit existant. **Non vérifiables ici** : indexation réelle Google (Search Console à faire par toi), cache serveur des images (limite Render static), scores Lighthouse sur le site déployé après redéploiement manuel.

Livrable : rapport final dans le dépôt (convention `AUDIT_SEO_*.md`) + résumé des modifs. Aucune migration, aucun impact fonctionnel ; l'identité visuelle est préservée (mêmes images, mêmes textes sauf reformulations signalées).