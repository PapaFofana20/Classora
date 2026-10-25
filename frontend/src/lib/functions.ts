import { supabase } from "@/lib/supabase";

/**
 * Appel de l'API backend (hébergée sur Render) avec la session courante ;
 * erreurs → messages FR. L'URL vient de VITE_API_URL, ex.
 * https://scolia-api.onrender.com — le contrat (enveloppe JSON, Bearer JWT,
 * { error } en échec) est identique aux anciennes Edge Functions.
 */
export async function callFunction<T>(
  name: string,
  body?: unknown,
  method: "POST" | "GET" | "PATCH" = "POST",
): Promise<T> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "");
  if (!base) {
    throw new Error("API non configurée : définissez VITE_API_URL pour ce build.");
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? anonKey;

  let res: Response;
  try {
    res = await fetch(`${base}/${name}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Service indisponible. Vérifiez que l'API est démarrée et que VITE_API_URL est correct.");
  }

  const raw = await res.text().catch(() => "");
  let payload: Record<string, unknown> = {};
  try {
    payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }

  if (!res.ok) {
    if (typeof payload.error === "string") throw new Error(payload.error);
    throw new Error(
      res.status === 404
        ? "Service introuvable (API indisponible ou route non déployée)."
        : `Erreur du service (HTTP ${res.status}). Réessayez dans un instant.`,
    );
  }
  return payload as T;
}
