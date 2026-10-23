import { AuthLayout } from "@/components/layout/AuthLayout";
import { Highlight } from "@/features/landing/Highlight";
import { LoginForm } from "@/features/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthLayout title={<>Bon retour, <Highlight>connectez-vous</Highlight></>} subtitle="Accédez à votre espace Classora : école, classes, notes, paiements et messages." showVisual={false}>
      <LoginForm />
    </AuthLayout>
  );
}
