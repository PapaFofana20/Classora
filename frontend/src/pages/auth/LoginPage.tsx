import { AuthLayout } from "@/components/layout/AuthLayout";
import { Highlight } from "@/features/landing/Highlight";
import { LoginForm } from "@/features/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthLayout title={<Highlight>Connectez-vous</Highlight>} subtitle="" showVisual={false} backgroundImage>
      <LoginForm />
    </AuthLayout>
  );
}
