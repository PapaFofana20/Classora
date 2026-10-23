import heroImg from "@/assets/images/hero.jpg";
import hero1Img from "@/assets/images/hero-1.jpg";
import hero2Img from "@/assets/images/hero-2.jpg";
import hero3Img from "@/assets/images/hero-3.jpg";
import hero4Img from "@/assets/images/hero-4.jpg";
import hero5Img from "@/assets/images/hero-5.jpg";
import hero6Img from "@/assets/images/hero-6.jpg";
import aboutImg from "@/assets/images/about-home.jpg";
import authImg from "@/assets/images/auth.jpg";
import inscriptionsImg from "@/assets/images/feature-inscriptions.jpg";
import bulletinsImg from "@/assets/images/feature-bulletins.jpg";
import paiementsImg from "@/assets/images/feature-paiements.jpg";
import messagerieImg from "@/assets/images/feature-messagerie.jpg";
import enseignantsImg from "@/assets/images/feature-enseignants.jpg";

export const images = { hero: heroImg, about: aboutImg, auth: authImg };

export interface HeroSlide {
  src: string;
  alt: string;
}

export const heroSlides: HeroSlide[] = [
  { src: hero1Img, alt: "Élève consultant son téléphone dans une salle de classe au Sénégal" },
  { src: hero2Img, alt: "Enseignante souriante devant son ordinateur dans une salle de classe" },
  { src: hero3Img, alt: "Deux membres de l'équipe Classora dans un couloir d'école" },
  { src: hero4Img, alt: "Quatre élèves travaillant sur des ordinateurs à la bibliothèque" },
  { src: hero5Img, alt: "L'équipe Classora serre la main d'un directeur d'école" },
  { src: hero6Img, alt: "Membre de l'équipe Classora devant une école sénégalaise" },
];

export const CONTACT = {
  phone: "+221 77 000 12 34",
  email: "contact@classora.sn",
  address: "Immeuble Teranga, Point E, Dakar, Sénégal",
  hours: "Du lundi au vendredi, 8 h – 18 h",
};

export const navLinks = [
  { to: "/", label: "Accueil" },
  { to: "/fonctionnalites", label: "Fonctionnalités" },
  { to: "/tarifs", label: "Tarifs" },
  { to: "/ecoles", label: "Écoles" },
  { to: "/a-propos", label: "À propos" },
  { to: "/contact", label: "Contact" },
];

export const logoStrip = ["Wave", "Orange Money", "Free Money", "Groupe Les Baobabs", "Institut Horizon", "Complexe Teranga", "Collège Kocc Barma"];

export interface Feature {
  id: string;
  title: string;
  description: string;
  image: string;
  bullets: string[];
}

export const features: Feature[] = [
  {
    id: "inscriptions",
    title: "Inscriptions simplifiées",
    description: "Dossier élève, parents, classe et frais en 3 étapes, avec réduction fratrie appliquée automatiquement.",
    image: inscriptionsImg,
    bullets: ["Inscription en 3 étapes", "Frais annexes : cantine, transport, tenue", "Réduction fratrie automatique", "Dossiers numériques sécurisés"],
  },
  {
    id: "bulletins",
    title: "Bulletins automatiques",
    description: "Moyennes, rangs et appréciations calculés pour l'élémentaire, le moyen et le secondaire, prêts à imprimer.",
    image: bulletinsImg,
    bullets: ["2 modèles : élémentaire et moyen/secondaire", "Coefficients par classe et série", "Rangs et appréciations automatiques", "Impression / PDF en un clic"],
  },
  {
    id: "paiements",
    title: "Paiements mobile money",
    description: "Les parents règlent les mensualités par Wave, Orange Money ou Free Money. Reçus et relances intégrés.",
    image: paiementsImg,
    bullets: ["Wave, Orange Money, Free Money", "Échéancier sur 10 mois", "Reçus instantanés", "Relances des impayés"],
  },
  {
    id: "messagerie",
    title: "Messagerie parents-enseignants",
    description: "Conversations directes, annonces de l'école et notifications pour garder les familles informées.",
    image: messagerieImg,
    bullets: ["Conversations par élève", "Annonces ciblées par rôle", "Badge de messages non lus", "Historique conservé"],
  },
  {
    id: "enseignants",
    title: "Enseignants et affectations",
    description: "Matrice classes × matières, professeurs principaux, instituteurs titulaires et détection des conflits.",
    image: enseignantsImg,
    bullets: ["Matrice classes × matières", "Instituteur titulaire = toutes les matières", "Professeur principal", "Détection de conflits"],
  },
];

export const steps = [
  { id: 1, icon: "tune", title: "Configurez votre école", text: "Choisissez vos cycles, vos périodes (semestres ou trimestres), vos matières et vos tarifs par niveau." },
  { id: 2, icon: "assignment_ind", title: "Affectez vos enseignants", text: "Un instituteur titulaire par classe à l'élémentaire, des professeurs par matière au moyen et au secondaire." },
  { id: 3, icon: "edit_note", title: "Saisissez les notes", text: "Chaque enseignant ne voit que ses classes. Moyennes, rangs et bulletins sont générés automatiquement." },
  { id: 4, icon: "savings", title: "Encaissez et communiquez", text: "Les parents paient par mobile money, reçoivent leurs reçus et échangent avec les enseignants, depuis un seul compte, même avec plusieurs enfants." },
];

export interface Plan {
  id: string;
  name: string;
  price: string;
  unit: string;
  description: string;
  highlight?: boolean;
  items: string[];
}

export const plans: Plan[] = [
  {
    id: "essentiel",
    name: "Plan découverte",
    price: "Gratuit",
    unit: "",
    description: "Pour les petites écoles qui débutent leur digitalisation.",
    items: ["Jusqu'à 150 élèves", "Un cycle au choix", "Inscriptions et dossiers élèves", "Notes et bulletins automatiques", "Support par e-mail"],
  },
  {
    id: "premium",
    name: "Premium",
    price: "500 FCFA",
    unit: "par élève / mois",
    description: "La solution complète pour les complexes scolaires.",
    highlight: true,
    items: ["Élèves illimités", "Tous les cycles", "Paiements Wave, Orange Money, Free Money", "Messagerie parents-enseignants", "Matrice d'affectations et conflits", "Support WhatsApp prioritaire"],
  },
  {
    id: "reseau",
    name: "Groupe scolaire",
    price: "Sur devis",
    unit: "multi-établissements",
    description: "Pour les réseaux d'écoles avec des besoins spécifiques.",
    items: ["Plusieurs établissements", "Tableau de bord consolidé", "Formation sur site", "Intégrations sur mesure", "Gestionnaire de compte dédié"],
  },
];

export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  school: string;
}

export const testimonials: Testimonial[] = [
  { id: "t1", quote: "Depuis Classora, nos bulletins sortent en une journée au lieu de deux semaines. Les parents paient par Wave sans se déplacer.", name: "Aïssatou Diallo", role: "Directrice", school: "Complexe Scolaire Les Almadies, Dakar" },
  { id: "t2", quote: "La matrice des affectations nous a évité des erreurs d'emploi du temps. Chaque professeur voit uniquement ses classes.", name: "Dr Mbaye Seck", role: "Directeur des études", school: "Institut Horizon, Thiès" },
  { id: "t3", quote: "Les impayés ont baissé de 35 % en un trimestre grâce aux relances et au paiement mobile money.", name: "Mame Diarra Gaye", role: "Économe", school: "Groupe Les Baobabs, Mbour" },
];

export interface Faq {
  q: string;
  a: string;
}

export const faqs: Faq[] = [
  { q: "Classora convient-il à une école élémentaire uniquement ?", a: "Oui. Vous choisissez les cycles proposés par votre école (élémentaire, moyen, secondaire). Chaque cycle a son modèle de bulletin et ses règles : un instituteur titulaire à l'élémentaire, plusieurs professeurs au moyen et secondaire." },
  { q: "Comment fonctionne le paiement par Wave, Orange Money ou Free Money ?", a: "Le parent choisit l'échéance à régler, sélectionne son opérateur et valide le paiement depuis son téléphone. Le reçu est généré immédiatement et l'économe voit le paiement en temps réel." },
  { q: "Un parent avec plusieurs enfants a-t-il plusieurs comptes ?", a: "Non. Un seul compte parent permet de suivre tous les enfants, même dans des cycles différents, grâce à un sélecteur d'enfant. La réduction fratrie est appliquée automatiquement." },
  { q: "Un professeur peut-il modifier les notes d'une autre classe ?", a: "Non. Un enseignant ne voit et ne saisit que les notes des couples classe/matière qui lui sont affectés. Le professeur principal dispose en plus d'une lecture de toutes les matières de sa classe." },
  { q: "Les bulletins respectent-ils le système sénégalais ?", a: "Oui. Devoirs et composition, coefficients par série, rang, appréciation du conseil de classe, conduite et absences. Les examens CFEE, BFEM et BAC sont pris en compte dans l'organisation des niveaux." },
  { q: "L'application fonctionne-t-elle avec une connexion lente ?", a: "Classora est conçu pour les connexions mobiles : pages légères, images compressées et chargement progressif." },
];

export const schoolPartners = [
  { id: "sp1", name: "Complexe Scolaire Les Almadies", city: "Dakar", cycles: ["Élémentaire", "Moyen", "Secondaire"], students: 620 },
  { id: "sp2", name: "Institut Horizon", city: "Thiès", cycles: ["Moyen", "Secondaire"], students: 410 },
  { id: "sp3", name: "Groupe Les Baobabs", city: "Mbour", cycles: ["Élémentaire", "Moyen"], students: 340 },
  { id: "sp4", name: "Collège Kocc Barma", city: "Saint-Louis", cycles: ["Moyen"], students: 280 },
  { id: "sp5", name: "École Les Pédagogues", city: "Rufisque", cycles: ["Élémentaire"], students: 210 },
  { id: "sp6", name: "Lycée Teranga Excellence", city: "Kaolack", cycles: ["Secondaire"], students: 260 },
];

export const aboutValues = [
  { title: "Transparence", text: "Les familles suivent notes, absences et paiements en temps réel." },
  { title: "Confiance", text: "Chaque rôle n'accède qu'aux données qui le concernent." },
  { title: "Simplicité", text: "Une interface pensée pour les directeurs, enseignants et parents, sur mobile d'abord." },
  { title: "Ancrage local", text: "Conçu avec des écoles sénégalaises, pour le système éducatif sénégalais." },
];

export const aboutStats = [
  { value: "2K+", label: "Élèves suivis" },
  { value: "18", label: "Écoles partenaires" },
  { value: "120M", label: "FCFA encaissés" },
];

export const footerColumns = [
  { title: "Produit", links: [{ to: "/fonctionnalites", label: "Fonctionnalités" }, { to: "/tarifs", label: "Tarifs" }, { to: "/ecoles", label: "Écoles partenaires" }] },
  { title: "Entreprise", links: [{ to: "/a-propos", label: "À propos" }, { to: "/contact", label: "Contact" }, { to: "/tarifs", label: "FAQ" }] },
  { title: "Accès", links: [{ to: "/connexion", label: "Se connecter" }, { to: "/inscription", label: "Créer un compte" }, { to: "/mot-de-passe-oublie", label: "Mot de passe oublié" }] },
  { title: "Légal", links: [{ to: "/cgu", label: "CGU" }, { to: "/confidentialite", label: "Politique de confidentialité" }] },
];
