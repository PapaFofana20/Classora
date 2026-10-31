import { lazy, Suspense, type ReactElement } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Skeleton } from "@/components/ui/Skeleton";
import { AuthProvider } from "@/context/AuthContext";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
import { PlatformProvider } from "@/context/PlatformContext";
import { SchoolProvider } from "@/context/SchoolContext";
import { ToastProvider } from "@/context/ToastContext";
import { MustChangePasswordGuard, ProtectedRoute, PublicOnlyRoute, RoleRoute, ScrollToTop, SubscriptionGuard } from "@/routes/guards";
import { AdminProtectedRoute } from "@/routes/adminGuards";
import { ROUTE_ROLES } from "@/routes/navigation";
import TimetableViewPage from "@/features/timetables/TimetableViewPage";
import HomePage from "@/pages/public/HomePage";

const FeaturesPage = lazy(() => import("@/pages/public/FeaturesPage"));
const PricingPage = lazy(() => import("@/pages/public/PricingPage"));
const SchoolsPage = lazy(() => import("@/pages/public/SchoolsPage"));
const AboutPage = lazy(() => import("@/pages/public/AboutPage"));
const ContactPage = lazy(() => import("@/pages/public/ContactPage"));
const TermsPage = lazy(() => import("@/pages/public/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/public/PrivacyPage"));
const NotFoundPage = lazy(() => import("@/pages/public/NotFoundPage"));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage"));
const SignupSentPage = lazy(() => import("@/pages/auth/SignupSentPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage"));
const ChangePasswordPage = lazy(() => import("@/pages/auth/ChangePasswordPage"));
const AdminLoginPage = lazy(() => import("@/pages/auth/AdminLoginPage"));
const DashboardPage = lazy(() => import("@/pages/app/DashboardPage"));
const StudentsPage = lazy(() => import("@/pages/app/StudentsPage"));
const StudentDetailPage = lazy(() => import("@/pages/app/StudentDetailPage"));
const PendingStudentsPage = lazy(() => import("@/pages/app/PendingStudentsPage"));
const StudentEnrollmentPage = lazy(() => import("@/pages/app/StudentEnrollmentPage"));
const ClassesPage = lazy(() => import("@/pages/app/ClassesPage"));
const StaffPage = lazy(() => import("@/pages/app/StaffPage"));
const AssignmentsPage = lazy(() => import("@/pages/app/AssignmentsPage"));
const NotesPage = lazy(() => import("@/pages/app/NotesPage"));
const BulletinsPage = lazy(() => import("@/pages/app/BulletinsPage"));
const PaymentsPage = lazy(() => import("@/pages/app/PaymentsPage"));
const MessagesPage = lazy(() => import("@/pages/app/MessagesPage"));
const SettingsPage = lazy(() => import("@/pages/app/SettingsPage"));
const SubscriptionPage = lazy(() => import("@/pages/app/SubscriptionPage"));
const AdminDashboardPage = lazy(() => import("@/pages/app/AdminDashboardPage"));
const AdminSchoolsPage = lazy(() => import("@/pages/app/AdminSchoolsPage"));
const AdminSchoolDetailPage = lazy(() => import("@/pages/app/AdminSchoolDetailPage"));
const AdminAgentsPage = lazy(() => import("@/pages/app/AdminAgentsPage"));
const AdminSubscriptionsPage = lazy(() => import("@/pages/app/AdminSubscriptionsPage"));
const AdminFinancesPage = lazy(() => import("@/pages/app/AdminFinancesPage"));
const AdminAnalyticsPage = lazy(() => import("@/pages/app/AdminAnalyticsPage"));
const AdminAuditPage = lazy(() => import("@/pages/app/AdminAuditPage"));
const AdminSecurityPage = lazy(() => import("@/pages/app/AdminSecurityPage"));
const AdminSettingsPage = lazy(() => import("@/pages/app/AdminSettingsPage"));

/** Wrapper : authentification scolaire (SchoolProvider). Ne s'applique qu'à /app/*. */
function SchoolAuthWrapper() {
  return (
    <SchoolProvider>
      <Outlet />
    </SchoolProvider>
  );
}

/** Wrapper : authentification administrative (AdminAuthProvider). Ne s'applique qu'à /admin/*. */
function AdminAuthWrapper() {
  return (
    <AdminAuthProvider>
      <Outlet />
    </AdminAuthProvider>
  );
}

function Fallback() {
  return (
    <div className="p-8" role="status" aria-label="Chargement de la page">
      <Skeleton className="mb-4 h-10 w-64" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

const guard = (roles: keyof typeof ROUTE_ROLES, element: ReactElement) => <RoleRoute roles={ROUTE_ROLES[roles]}>{element}</RoleRoute>;

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        {/* AuthProvider enveloppe TOUTES les routes (comme dans le code original),
            afin que useAuth() fonctionne partout (PublicOnlyRoute, ProtectedRoute, etc.). */}
        <AuthProvider>
          <PlatformProvider>
            <ScrollToTop />
            <Suspense fallback={<Fallback />}>
              <Routes>
            {/* PARTIE 1 : site public */}
            <Route element={<PublicLayout />}>
              <Route index element={<HomePage />} />
              <Route path="fonctionnalites" element={<FeaturesPage />} />
              <Route path="tarifs" element={<PricingPage />} />
              <Route path="ecoles" element={<SchoolsPage />} />
              <Route path="a-propos" element={<AboutPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="cgu" element={<TermsPage />} />
              <Route path="confidentialite" element={<PrivacyPage />} />
              {/* 404 réelle (contenu + noindex) au lieu d'une redirection vers
                  l'accueil, qui fabriquait des « soft 404 ». */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* PARTIE 2 : authentification scolaire (pas de session requise)} */}
            <Route element={<PublicOnlyRoute />}>
              <Route path="connexion" element={<LoginPage />} />
              <Route path="inscription" element={<RegisterPage />} />
              <Route path="inscription-envoyee" element={<SignupSentPage />} />
              <Route path="mot-de-passe-oublie" element={<ForgotPasswordPage />} />
            </Route>

            <Route path="reinitialiser-mot-de-passe" element={<ResetPasswordPage />} />

            {/* PARTIE 3 : authentification administrative (isolée de l'auth scolaire) */}
            <Route path="admin" element={<AdminAuthWrapper />}>
              <Route path="connexion" element={<AdminLoginPage />} />
              {/* Garde réellement branchée : sans elle, /admin affichait une page vide
                  au lieu de rediriger vers /admin/connexion. */}
              <Route element={<AdminProtectedRoute />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="ecoles" element={<AdminSchoolsPage />} />
                  <Route path="ecoles/:id" element={<AdminSchoolDetailPage />} />
                  <Route path="agents" element={<AdminAgentsPage />} />
                  <Route path="abonnements" element={<AdminSubscriptionsPage />} />
                  <Route path="abonnements/offres" element={<AdminSubscriptionsPage />} />
                  <Route path="finances" element={<AdminFinancesPage />} />
                  <Route path="finances/transactions" element={<AdminFinancesPage />} />
                  <Route path="finances/factures" element={<AdminFinancesPage />} />
                  <Route path="analyses" element={<AdminAnalyticsPage />} />
                  <Route path="supervision/audit" element={<AdminAuditPage />} />
                  <Route path="supervision/securite" element={<AdminSecurityPage />} />
                  <Route path="parametres" element={<AdminSettingsPage />} />
                  <Route path="*" element={<Navigate to="/admin" replace />} />
                </Route>
              </Route>
            </Route>

            {/* PARTIE 4 : tableau de bord scolaire protégé */}
            <Route path="app" element={<SchoolAuthWrapper />}>
              <Route element={<ProtectedRoute />}>
                <Route element={<MustChangePasswordGuard />}>
                  <Route path="mot-de-passe-temporaire" element={<ChangePasswordPage />} />
                  {/* Verrou d'abonnement (écoles bloquées/sans abonnement) :
                      il était défini mais jamais monté — les écrans dédiés
                      de SubscriptionScreens étaient du code mort. */}
                  <Route element={<SubscriptionGuard />}>
                  <Route path="" element={<DashboardLayout />}>
                      <Route index element={<DashboardPage />} />
                      <Route path="eleves" element={guard("eleves", <StudentsPage />)} />
                      <Route path="eleves/demandes" element={guard("demandes", <PendingStudentsPage />)} />
                      <Route path="eleves/:id" element={guard("eleve", <StudentDetailPage />)} />
                      <Route path="inscription-eleve" element={guard("inscription", <StudentEnrollmentPage />)} />
                      <Route path="classes" element={guard("classes", <ClassesPage />)} />
                      <Route path="enseignants" element={guard("enseignants", <StaffPage />)} />
                      <Route path="affectations" element={guard("affectations", <AssignmentsPage />)} />
                      <Route path="abonnement" element={guard("abonnement", <SubscriptionPage />)} />
                      <Route path="notes" element={guard("notes", <NotesPage />)} />
                      <Route path="bulletins" element={guard("bulletins", <BulletinsPage />)} />
                      <Route path="paiements" element={guard("paiements", <PaymentsPage />)} />
                      <Route path="messages" element={guard("messages", <MessagesPage />)} />


                      <Route path="parametres" element={guard("parametres", <SettingsPage />)} />
                      <Route path="timetables" element={guard("timetables", <TimetableViewPage />)} />
                      <Route path="*" element={<Navigate to="/app" replace />} />
                    </Route>
                  </Route>
                </Route>
                </Route>
            </Route>
            {/* Le 404 racine est géré dans PublicLayout (catch-all ci-dessus). */}
            </Routes>
            </Suspense>
          </PlatformProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}