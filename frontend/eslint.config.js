import js from "@eslint/js";
import typescriptEslint from "typescript-eslint";

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
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-useless-assignment": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
  // Override TypeScript ESLint config to disable react-hooks/exhaustive-deps
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": {
        rules: {
          "exhaustive-deps": "off",
        },
      },
    },
    rules: {
      "react-hooks/exhaustive-deps": "off",
    },
  },
];