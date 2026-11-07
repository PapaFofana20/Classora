// Page de connexion réservée aux agents de l'administration Classora.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { supabase } from "@/lib/supabase";
import { adminResolveLogin, adminVerifyMFA, type AdminLoginResult } from "@/services/admin";
import { usePageMeta } from "@/hooks/usePageMeta";

const TOTP_CODE_RE = /^\d{6}$/;

type MfaStep = "idle" | "waitingTotp";

// Composant principal de la page.
export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { verify, logout } = useAdminAuth();
  usePageMeta({ title: "Connexion administrative", noindex: true });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [mfaStep, setMfaStep] = useState<MfaStep>("idle");
  const [preAuthToken, setPreAuthToken] = useState("");
  const [totpCode, setTotpCode] = useState("");

  // On lance la connexion admin, avec un second facteur si nécessaire.
  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // 1. Résout la matricule/e-mail via l'API (mot de passe vérifié côté
      // serveur). Si le MFA est activé, l'API retourne mfaRequired + un
      // jeton pré-authentifié à usage unique : le client doit d'abord valider
      // le second facteur avant de demander le jeton Supabase.
      const trimmed = identifier.trim();
      const result: AdminLoginResult = await adminResolveLogin({
        identifier: trimmed,
        password,
      });

      if ("mfaRequired" in result) {
        setPreAuthToken(result.preAuthToken);
        setMfaStep("waitingTotp");
        setBusy(false);
        return;
      }

      const email = result.email;

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

      // 3. Vérifie le profil administrateur via l'API backend.
      const verification = await verify();
      if (verification.ok) {
        navigate("/admin", { replace: true });
      } else {
        await logout();
        setError(verification.error ?? "Aucun accès administratif associé à ce compte.");
        setBusy(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion impossible. Réessayez.");
      setBusy(false);
    }
  };

  const doVerifyMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!TOTP_CODE_RE.test(totpCode)) {
        setError("Code TOTP invalide (6 chiffres).");
        setBusy(false);
        return;
      }

      // Valide le second facteur via l'API backend. Retourne l'email de
      // l'agent (nécessaire pour le signInWithPassword Supabase).
      const { email } = await adminVerifyMFA({ preAuthToken, token: totpCode });

      // 2. Connexion via Supabase Auth.
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        setError("Matricule/e-mail ou mot de passe incorrect.");
        setBusy(false);
        return;
      }

      // 3. Vérifie le profil administrateur (l'API vérifiera la session MFA).
      const verification = await verify();
      if (verification.ok) {
        setMfaStep("idle");
        setTotpCode("");
        setPreAuthToken("");
        navigate("/admin", { replace: true });
      } else {
        await logout();
        setError(verification.error ?? "Aucun accès administratif associé à ce compte.");
        setBusy(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la validation du second facteur.");
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
      {mfaStep === "waitingTotp" ? (
        <form onSubmit={doVerifyMFA} noValidate className="space-y-4" aria-label="Validation du second facteur">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm font-medium text-danger">
              <Icon name="error" className="text-[20px]" />
              <span>{error}</span>
            </div>
          )}
          <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            <Icon name="shield" className="text-[20px]" />
            <p className="mt-1 font-medium">
              Second facteur requis — saisissez le code de votre application d’authentification.
            </p>
          </div>
          <Input
            label="Code TOTP (6 chiffres)"
            type="text"
            icon="lock"
            autoComplete="one-time-code"
            placeholder="123456"
            required
            maxLength={6}
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <div className="flex justify-end">
            <Link to="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-forest underline-offset-4 hover:underline">
              Retour au site public
            </Link>
          </div>
          <Button type="submit" size="lg" variant="dark" className="w-full" loading={busy} disabled={busy}>
            Valider le code
          </Button>
        </form>
      ) : (
        <form onSubmit={doLogin} noValidate className="space-y-4" aria-label="Formulaire de connexion administrative">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm font-medium text-danger">
              <Icon name="error" className="text-[20px]" />
              <span>
                {error}
                {error.includes("compte scolaire") && (
                  <>
                    {" "}
                    <Link to="/connexion" className="font-bold underline underline-offset-4">
                      Se connecter à l’espace école
                    </Link>
                  </>
                )}
              </span>
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
      )}
    </AuthLayout>
  );
}