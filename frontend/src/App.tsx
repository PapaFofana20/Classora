import { lazy, Suspense, type ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Skeleton } from "@/components/ui/Skeleton";
import { AuthProvider } from "@/context/AuthContext";
import { SchoolProvider } from "@/context/SchoolContext";
import { ToastProvider } from "@/context/ToastContext";
import { MustChangePasswordGuard, ProtectedRoute, PublicOnlyRoute, RoleRoute, ScrollToTop } from "@/routes/guards";
import { ROUTE_ROLES } from "@/routes/navigation";
import HomePage from "@/pages/public/HomePage";

const FeaturesPage = lazy(() => import("@/pages/public/FeaturesPage"));
const PricingPage = lazy(() => import("@/pages/public/PricingPage"));
const SchoolsPage = lazy(() => import("@/pages/public/SchoolsPage"));
const AboutPage = lazy(() => import("@/pages/public/AboutPage"));
const ContactPage = lazy(() => import("@/pages/public/ContactPage"));
const TermsPage = lazy(() => import("@/pages/public/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/public/PrivacyPage"));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage"));
const SignupSentPage = lazy(() => import("@/pages/auth/SignupSentPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage"));
const ChangePasswordPage = lazy(() => import("@/pages/auth/ChangePasswordPage"));
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
        <AuthProvider>
          <SchoolProvider>
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
              </Route>

              {/* PARTIE 2 : authentification */}
              <Route element={<PublicOnlyRoute />}>
                <Route path="connexion" element={<LoginPage />} />
                <Route path="inscription" element={<RegisterPage />} />
                <Route path="inscription-envoyee" element={<SignupSentPage />} />
                <Route path="mot-de-passe-oublie" element={<ForgotPasswordPage />} />
              </Route>

              {/* PARTIE 3 : tableau de bord protégé */}
              <Route element={<ProtectedRoute />}>
                <Route element={<MustChangePasswordGuard />}>
                  <Route path="app/mot-de-passe-temporaire" element={<ChangePasswordPage />} />
                  <Route path="app" element={<DashboardLayout />}>
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
                      <Route path="*" element={<Navigate to="/app" replace />} />
                    </Route>
                  </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </SchoolProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}