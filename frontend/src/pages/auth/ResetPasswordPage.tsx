import { AuthLayout } from "@/components/layout/AuthLayout";
import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function ResetPasswordPage() {
  usePageMeta({ title: "Nouveau mot de passe", noindex: true });
  return (
    <AuthLayout title="Nouveau mot de passe" subtitle="Définissez un nouveau mot de passe pour accéder à votre compte." showVisual={false}>
      <ResetPasswordForm />
    </AuthLayout>
  );
}
