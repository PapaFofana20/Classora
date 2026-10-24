import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { verify, logout } = useAdminAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // 1. Connexion via Supabase Auth (identique à la connexion scolaire).
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });
      if (authError) {
        setError("E-mail ou mot de passe incorrect.");
        setBusy(false);
        return;
      }

      // 2. Vérifie le profil administrateur via l'API backend.
      const ok = await verify();
      if (ok) {
        navigate("/admin", { replace: true });
      } else {
        await logout();
        setError("Aucun accès administratif associé à ce compte.");
        setBusy(false);
      }
    } catch {
      setError("Connexion impossible. Réessayez.");
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={<>Connexion administrative</>}
      subtitle="Espace réservé aux agents Classora."
      showVisual={false}
      backgroundImage
    >
      <form onSubmit={doLogin} noValidate className="space-y-4" aria-label="Formulaire de connexion administrative">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm font-medium text-danger">
            <Icon name="error" className="text-[20px]" />
            {error}
          </div>
        )}
        <Input
          label="Adresse e-mail administrative"
          type="email"
          icon="mail"
          autoComplete="email"
          placeholder="admin@classora.sn"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="relative">
          <Input
            label="Mot de passe"
            type={show ? "text" : "password"}
            icon="lock"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute right-1 top-[29px] grid size-11 place-items-center rounded-full text-forest/70 hover:bg-mist"
          >
            <Icon name={show ? "visibility_off" : "visibility"} className="text-[20px]" />
          </button>
        </div>
        <div className="flex justify-end">
          <Link to="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-forest underline-offset-4 hover:underline">
            Retour au site public
          </Link>
        </div>
        <Button type="submit" size="lg" variant="dark" className="w-full" loading={busy} disabled={busy}>
          Se connecter
        </Button>
      </form>
    </AuthLayout>
  );
}