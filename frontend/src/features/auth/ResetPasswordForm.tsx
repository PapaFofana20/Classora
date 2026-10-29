import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PasswordField } from "@/features/auth/PasswordField";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { resetPassword } from "@/services/authService";
import { supabase } from "@/lib/supabase";
import { passwordError } from "@/utils/password";

type Status = "checking" | "ready" | "invalid" | "done";

export function ResetPasswordForm() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session) setStatus("ready");
    });

    const checkLink = async () => {
      const url = new URL(window.location.href);
      if (url.searchParams.get("error") || url.searchParams.get("error_code")) {
        if (!cancelled) setStatus("invalid");
        return;
      }

      const tokenHash = url.searchParams.get("token_hash");
      if (tokenHash && url.searchParams.get("type") === "recovery") {
        const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        if (!cancelled) setStatus(otpError ? "invalid" : "ready");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        if (!cancelled) setStatus("ready");
        return;
      }

      for (let attempt = 0; attempt < 15; attempt++) {
        await new Promise((resolve) => window.setTimeout(resolve, 200));
        if (cancelled) return;
        const { data: retry } = await supabase.auth.getSession();
        if (retry.session) {
          setStatus("ready");
          return;
        }
      }

      if (!cancelled) setStatus("invalid");
    };

    void checkLink();
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    const nextError = passwordError(password, confirm);
    setError(nextError);
    if (nextError) return;

    setBusy(true);
    try {
      await resetPassword(password);
      logout();
      toast("Mot de passe réinitialisé. Vous pouvez vous connecter.");
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Réinitialisation impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  if (status === "checking") {
    return (
      <div role="status" className="rounded-3xl bg-mist p-8 text-center">
        <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-forest border-t-transparent" aria-hidden="true" />
        <p className="mt-4 text-sm font-medium text-neutral-600">Vérification du lien…</p>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="rounded-3xl bg-red-50 p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-forest text-lime">
          <Icon name="link_off" fill className="text-[28px]" />
        </span>
        <h2 className="mt-4 text-xl font-bold text-ink">Lien invalide ou expiré</h2>
        <p className="mt-2 text-sm text-neutral-700">Ce lien de réinitialisation n'est plus valable. Demandez-en un nouveau pour choisir votre mot de passe.</p>
        <LinkButton to="/mot-de-passe-oublie" variant="dark" className="mt-6">
          Demander un nouveau lien
        </LinkButton>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div role="status" className="rounded-3xl bg-lime-soft p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-forest text-lime">
          <Icon name="check" fill className="text-[28px]" />
        </span>
        <h2 className="mt-4 text-xl font-bold text-ink">Mot de passe réinitialisé</h2>
        <p className="mt-2 text-sm text-neutral-700">Votre mot de passe a bien été modifié. Connectez-vous avec vos nouveaux identifiants.</p>
        <LinkButton to="/connexion" variant="dark" className="mt-6">
          Se connecter
        </LinkButton>
      </div>
    );
  }

  const passwordErr = touched ? passwordError(password) : null;
  const confirmErr = touched && confirm && confirm !== password ? "Les mots de passe ne correspondent pas." : null;

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Réinitialisation du mot de passe">
      <div className="flex items-start gap-2 rounded-2xl bg-lime-soft p-4 text-sm text-forest">
        <Icon name="shield_lock" className="text-[20px]" />
        <p>Choisissez un nouveau mot de passe pour sécuriser votre compte.</p>
      </div>
      <PasswordField
        label="Nouveau mot de passe"
        placeholder="••••••••"
        value={password}
        onChange={(value) => {
          setPassword(value);
          setError(null);
        }}
        error={passwordErr}
      />
      <PasswordField
        label="Confirmer le mot de passe"
        showStrength={false}
        placeholder="••••••••"
        value={confirm}
        onChange={(value) => {
          setConfirm(value);
          setError(null);
        }}
        error={confirmErr}
      />
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" variant="dark" className="w-full" loading={busy}>
        Enregistrer le nouveau mot de passe
      </Button>
      <p className="text-center text-sm">
        <Link to="/connexion" className="font-bold text-forest underline-offset-4 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
