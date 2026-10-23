import { AuthLayout } from "@/components/layout/AuthLayout";
import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Nouveau mot de passe" subtitle="Définissez un nouveau mot de passe pour accéder à votre compte." showVisual={false}>
      <ResetPasswordForm />
    </AuthLayout>
  );
}
