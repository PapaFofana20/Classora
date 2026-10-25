import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { supabase } from "@/lib/supabase";
import { adminResolveLogin } from "@/services/admin";
import { usePageMeta } from "@/hooks/usePageMeta";

const MATRICULE_RE = /^CLA-ADM-\d{6}$/i;

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { verify, logout } = useAdminAuth();
  usePageMeta({ title: "Connexion administrative", noindex: true });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // 1. Résout la matricule en e-mail via l'API (le mot de passe est
      // vérifié côté serveur : aucune information sans secret valide).
      // Un e-mail est utilisé tel quel.
      const trimmed = identifier.trim();
      let email = trimmed.toLowerCase();
      if (MATRICULE_RE.test(trimmed)) {
        const { email: resolved } = await adminResolveLogin({ identifier: trimmed, password });
        email = resolved;
      }

      // 2. Connexion via Supabase Auth (identique à la connexion scolaire).
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        setError("Matricule/e-mail ou mot de passe incorrect.");
        setBusy(false);
        return;
      }

      // 3. Vérifie le profil administrateur via l'API backend. On affiche le
      // message exact (profil absent, compte désactivé, API indisponible) au
      // lieu de le masquer derrière « aucun accès ».
      const result = await verify();
      if (result.ok) {
        navigate("/admin", { replace: true });
      } else {
        await logout();
        setError(result.error ?? "Aucun accès administratif associé à ce compte.");
        setBusy(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion impossible. Réessayez.");
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
          label="Matricule ou e-mail administratif"
          type="text"
          icon="badge"
          autoComplete="username"
          placeholder="CLA-ADM-000001 ou admin@classora.sn"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
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