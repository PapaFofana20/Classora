import js from "@eslint/js";
import typescriptEslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/", "node_modules/", "scripts/"] },
  ...typescriptEslint.configs.recommended,
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "19.2.6" } },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // Qualité / sécurité TS : ne plus laisser passer n'importe quoi.
      "@typescript-eslint/no-explicit-any": ["warn", { fixToUnknown: true }],
      "@typescript-eslint/ban-ts-comment": ["warn", { "ts-ignore": true, "ts-nocheck": true, "ts-expect-error": false }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-useless-assignment": "off",

      // Règles React Hooks réactivées (fichier stocké avant : plugin inexistant).
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
