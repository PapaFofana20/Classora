import inscriptionsImg from "@/assets/images/feature-inscriptions.jpg";
import paiementsImg from "@/assets/images/feature-paiements.jpg";
import enseignantsImg from "@/assets/images/feature-enseignants.jpg";
import aboutImg from "@/assets/images/about.jpg";
import authImg from "@/assets/images/auth.jpg";

/** Un mot encadré par des astérisques est rendu en Playfair italique lime. */
export interface PageHeroImage {
  src: string;
  alt: string;
  /** Recadrage CSS (object-position) pour que les 5 heroes ne se ressemblent pas. */
  objectPosition?: string;
  width: number;
  height: number;
}

export interface PageHeroCta {
  label: string;
  to: string;
}

export interface PageHeroData {
  title: string;
  description: string;
  primaryCta?: PageHeroCta;
  secondaryCta?: PageHeroCta;
  image: PageHeroImage;
}

/** Contenus des 5 heroes de pages publiques secondaires. */
export const pageHeroes: Record<"fonctionnalites" | "tarifs" | "ecoles" | "apropos" | "contact", PageHeroData> = {
  fonctionnalites: {
    title: "Tout ce qu'il faut pour gérer votre *école*",
    description: "Inscriptions, bulletins, paiements mobile money et messagerie : un seul outil pour la direction, les enseignants et les parents.",
    primaryCta: { label: "Créer un compte", to: "/inscription" },
    secondaryCta: { label: "Voir les tarifs", to: "/tarifs" },
    image: { src: inscriptionsImg, alt: "Élèves en classe écrivant dans leurs cahiers", objectPosition: "50% 35%", width: 1536, height: 1024 },
  },
  tarifs: {
    title: "Un tarif clair, calculé par *élève*",
    description: "Choisissez la formule adaptée à l'effectif de votre école. Paiement par Wave, Orange Money ou Free Money.",
    primaryCta: { label: "Créer un compte", to: "/inscription" },
    image: { src: paiementsImg, alt: "Parent effectuant un paiement depuis son téléphone", objectPosition: "60% 45%", width: 1370, height: 1148 },
  },
  ecoles: {
    title: "Une plateforme pensée pour les *écoles* privées du Sénégal",
    description: "Découvrez comment les établissements privés organisent leurs classes, leurs notes et leurs paiements avec EcoleConnect.",
    primaryCta: { label: "Créer un compte", to: "/inscription" },
    image: { src: enseignantsImg, alt: "Enseignante devant un tableau noir face à ses élèves", objectPosition: "35% 35%", width: 1536, height: 1024 },
  },
  apropos: {
    title: "Né au Sénégal, pensé pour les *écoles* d'ici",
    description: "Nous construisons un outil adapté au système éducatif sénégalais, de l'élémentaire à la terminale.",
    primaryCta: { label: "Nous contacter", to: "/contact" },
    image: { src: aboutImg, alt: "Équipe pédagogique réunie dans une école partenaire", objectPosition: "50% 30%", width: 1536, height: 1024 },
  },
  contact: {
    title: "Parlons de votre *école*",
    description: "Une question, une démonstration ou un besoin spécifique ? Écrivez-nous, nous vous répondons rapidement.",
    image: { src: authImg, alt: "Élèves dans une salle de classe", objectPosition: "50% 30%", width: 1536, height: 1024 },
  },
};