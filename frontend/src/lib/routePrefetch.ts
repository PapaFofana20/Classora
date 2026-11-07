/**
 * Préchargement des chunks de pages au survol / focus des liens.
 *
 * Les pages sont chargées en `lazy()` dans App.tsx : sans préchargement,
 * le clic doit d'abord télécharger le chunk, puis afficher la page
 * (perception de lenteur). Ici, dès que le pointeur survole un lien
 * (ou qu'il reçoit le focus clavier), on déclenche le même `import()`
 * que celui de App.tsx — le navigateur met le chunk en cache et la
 * navigation devient quasi instantanée.
 *
 * Les clés sont des préfixes de chemin (le plus long gagne), ce qui
 * couvre les routes dynamiques (ex. /app/eleves/:id).
 */
type Loader = () => Promise<unknown>;

const LOADERS: Record<string, Loader> = {
  // Site public
  "/": () => import("@/pages/public/HomePage"),
  "/fonctionnalites": () => import("@/pages/public/FeaturesPage"),
  "/tarifs": () => import("@/pages/public/PricingPage"),
  "/ecoles": () => import("@/pages/public/SchoolsPage"),
  "/a-propos": () => import("@/pages/public/AboutPage"),
  "/contact": () => import("@/pages/public/ContactPage"),
  "/cgu": () => import("@/pages/public/TermsPage"),
  "/confidentialite": () => import("@/pages/public/PrivacyPage"),
  // Authentification
  "/connexion": () => import("@/pages/auth/LoginPage"),
  "/inscription/premium": () => import("@/pages/auth/PremiumRegisterPage"),
  "/inscription": () => import("@/pages/auth/RegisterPage"),
  "/inscription-envoyee": () => import("@/pages/auth/SignupSentPage"),
  "/mot-de-passe-oublie": () => import("@/pages/auth/ForgotPasswordPage"),
  "/reinitialiser-mot-de-passe": () => import("@/pages/auth/ResetPasswordPage"),
  // Espace scolaire
  "/app/mot-de-passe-temporaire": () => import("@/pages/auth/ChangePasswordPage"),
  "/app/eleves/demandes": () => import("@/pages/app/PendingStudentsPage"),
  "/app/eleves/": () => import("@/pages/app/StudentDetailPage"),
  "/app/eleves": () => import("@/pages/app/StudentsPage"),
  "/app/inscription-eleve": () => import("@/pages/app/StudentEnrollmentPage"),
  "/app/classes": () => import("@/pages/app/ClassesPage"),
  "/app/enseignants": () => import("@/pages/app/StaffPage"),
  "/app/affectations": () => import("@/pages/app/AssignmentsPage"),
  "/app/abonnement": () => import("@/pages/app/SubscriptionPage"),
  "/app/notes": () => import("@/pages/app/NotesPage"),
  "/app/bulletins": () => import("@/pages/app/BulletinsPage"),
  "/app/paiements": () => import("@/pages/app/PaymentsPage"),
  "/app/parametres": () => import("@/pages/app/SettingsPage"),
  "/app/timetables/nouveau": () => import("@/features/timetables/TimetableCreationPage"),
  "/app/timetables/": () => import("@/features/timetables/TimetableViewPage"),
  "/app/timetables": () => import("@/features/timetables/TimetableViewPage"),
  "/app": () => import("@/pages/app/DashboardPage"),
  // Administration
  "/admin/ecoles/": () => import("@/pages/app/AdminSchoolDetailPage"),
  "/admin/ecoles": () => import("@/pages/app/AdminSchoolsPage"),
  "/admin/agents": () => import("@/pages/app/AdminAgentsPage"),
  "/admin/abonnements": () => import("@/pages/app/AdminSubscriptionsPage"),
  "/admin/finances": () => import("@/pages/app/AdminFinancesPage"),
  "/admin/analyses": () => import("@/pages/app/AdminAnalyticsPage"),
  "/admin/supervision/audit": () => import("@/pages/app/AdminAuditPage"),
  "/admin/supervision/securite": () => import("@/pages/app/AdminSecurityPage"),
  "/admin/parametres": () => import("@/pages/app/AdminSettingsPage"),
  "/admin/connexion": () => import("@/pages/auth/AdminLoginPage"),
  "/admin": () => import("@/pages/app/AdminDashboardPage"),
};

const PREFIXES = Object.keys(LOADERS).sort((a, b) => b.length - a.length);

/** Déclenche le chargement du chunk d'une route (sans bloquer l'UI). */
export function preloadRoute(to: string | undefined | null): void {
  if (!to || typeof to !== "string") return;
  // Liens externes / ancres / protocoles : rien à précharger.
  if (/^(https?:|mailto:|tel:|#)/.test(to)) return;
  const path = to.split(/[?#]/, 1)[0] || "/";
  for (const prefix of PREFIXES) {
    if (prefix === "/" || path === prefix || path.startsWith(prefix)) {
      // "/" ne doit matcher que la racine exacte.
      if (prefix === "/" && path !== "/") continue;
      void LOADERS[prefix]().catch(() => {
        /* chunk indisponible : la navigation affichera l'erreur normalement */
      });
      return;
    }
  }
}
