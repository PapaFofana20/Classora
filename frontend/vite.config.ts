import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// vite-plugin-singlefile est réservé au build de production.
// En mode dev, il peut empêcher l'exécution correcte du JavaScript (écran blanc).
const isDev = process.env.NODE_ENV === "development";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // base "/" : les ressources publiques (favicons, images, manifest) restent
    // accessibles depuis toutes les routes profondes de la SPA. Le plugin
    // singlefile force sinon base "./", ce qui cassait /favicon.svg dès qu'on
    // ouvrait /app/... (l'URL relative pointait vers /app/favicon.svg).
    isDev ? [] : [viteSingleFile({ overrideConfig: { base: "/" } })],
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});