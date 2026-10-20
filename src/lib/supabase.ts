import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Client Supabase typé, destiné à remplacer la couche localStorage
 * (src/services/db.ts) phase par phase. Aucun service_role ici : la clé
 * `anon` ne peut lever que ce que la RLS autorise.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // En mode démo (sans back-end branché), l'URL est absente : les services
  // actuels restent sur localStorage tant que la migration n'est pas complète.
  throw new Error("Supabase n'est pas configuré : définissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const tables = supabase;
export default supabase;
