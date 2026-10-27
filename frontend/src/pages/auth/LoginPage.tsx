import { AuthLayout } from "@/components/layout/AuthLayout";
import { LoginForm } from "@/features/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthLayout title={<>Bon retour, connectez-vous</>} subtitle="Accédez à votre espace Classora : école, classes, notes, paiements et messages." showVisual={false} backgroundImage>
      <LoginForm />
    </AuthLayout>
  );
}
