import { supabase } from "@/lib/supabase";

/**
 * Appel de l'API backend (hébergée sur Render) avec la session courante ;
 * erreurs → messages FR. L'URL vient de VITE_API_URL, ex.
 * https://scolia-api.onrender.com — le contrat (enveloppe JSON, Bearer JWT,
 * { error } en échec) est identique aux anciennes Edge Functions.
 */
export async function callFunction<T>(name: string, body?: unknown, method: "POST" | "GET" = "POST"): Promise<T> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "");
  if (!base) {
    throw new Error("API non configurée : définissez VITE_API_URL.");
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? anonKey;
  const res = await fetch(`${base}/${name}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: method === "POST" && body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Erreur inattendue. Réessayez dans un instant.");
  }
  return payload as T;
}
